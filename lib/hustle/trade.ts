import "server-only";
import type postgres from "postgres";
import { sql, transaction } from "../db";
import { lagosDate } from "../util";
import { BLOCKED_WORDS } from "../validate";
import { activeEvents, addDays, eventFactor, getBusinessById, getBusinessByOwner, getType, type Db } from "./data";
import { costOfSale } from "./day";
import { hash32 } from "./engine";
import { business as bizPot, move, NotEnoughMoney, SYSTEM, wallet } from "./ledger";
import { needFor, NEEDS, type NeedKey } from "./needs";
import { getHustleSettings } from "./settings";
import type { Business, BusinessType } from "./types";
import { ensureWallet, lagosDayStart } from "./wallet";

type Tx = postgres.ReservedSql;

/** At most this many purchases a day from the same seller. */
export const MAX_DAILY_FROM_SELLER = 3;
const DAY_MS = 86400_000;

/** Who pays for a purchase: the buyer's wallet (needs), or their business (supplies and B2B services). */
export type BuyMode = "need" | "supply" | "service";

/** What buying from this seller means for this buyer, or why they can't. */
export function buyMode(seller: BusinessType, buyerType: BusinessType | null): BuyMode | null {
  if (seller.kind === "b2b") return buyerType ? "service" : null;
  if (seller.kind === "supplier") return buyerType?.supply_type === seller.slug ? "supply" : null;
  if (seller.sells_supply && buyerType?.supply_type === seller.slug) return "supply";
  return seller.need_key ? "need" : null;
}

/** B2B services: what a carpenter's piece, a creator's campaign or a mechanic's job does for the buyer. */
export const SERVICE_EFFECT: Record<string, string> = {
  content_creator: "+5% customers for 7 days",
  carpenter: "+0.1 to your rating",
  mechanic: "+10% capacity for 3 days",
};

async function applyService(tx: Tx, buyer: Business, sellerType: string, date: string) {
  if (sellerType === "content_creator") {
    await tx`INSERT INTO hustle_modifiers (business_id, kind, value, starts_on, ends_on, label)
             VALUES (${buyer.id}, 'demand', 1.05, ${date}, ${addDays(date, 6)}, 'Promo campaign')`;
  } else if (sellerType === "carpenter") {
    await tx`UPDATE hustle_businesses SET rating = least(5, rating + 0.1) WHERE id = ${buyer.id}`;
  } else if (sellerType === "mechanic") {
    await tx`INSERT INTO hustle_modifiers (business_id, kind, value, starts_on, ends_on, label)
             VALUES (${buyer.id}, 'capacity', 1.1, ${date}, ${addDays(date, 2)}, 'Fresh tune-up')`;
  }
}

/** Records a sale on the seller's day: counts, revenue, and supplies used (for businesses that pay per sale). */
async function recordPlayerSale(tx: Tx, seller: Business, t: BusinessType, qty: number, total: number, date: string) {
  const [supply, s, events] = await Promise.all([
    t.supply_type ? getType(tx, t.supply_type) : Promise.resolve(null),
    getHustleSettings(tx as unknown as typeof sql),
    activeEvents(tx, seller.state, date),
  ]);
  const sale = await costOfSale(tx, seller, t, supply, s, eventFactor(events, t, "cost"), qty, date);
  await tx`
    UPDATE hustle_days SET units_sold_players = units_sold_players + ${qty}, revenue = revenue + ${total},
      cost_of_goods = cost_of_goods + ${sale.cogs}, supply_extra = supply_extra + ${sale.extra}
    WHERE business_id = ${seller.id} AND day_date = ${date}::date
  `;
}

export type BuyResult = { ok: true; orderId: number; message: string } | { error: string };

/**
 * Buys from a player's listing today. Locks the listing row, so parallel buyers can never take more than is
 * left. Needs are paid from the wallet; supplies and services from the buyer's business cash.
 */
export async function buyFromListing(
  user: { id: string; nickname: string; state: string | null; is_flagged: boolean },
  listingId: number,
  qty: number,
): Promise<BuyResult> {
  if (!Number.isInteger(qty) || qty < 1 || qty > 50) return { error: "Choose how many to buy." };
  if (user.is_flagged) return { error: "Trading is paused on your account while we check it. Message the Kopamate team." };
  const date = lagosDate();
  try {
    return await transaction(async (tx) => {
      const [l] = await tx<{ id: number; business_id: string; units: number; price: number; day: string }[]>`
        SELECT id, business_id, units_available AS units, price, day_date::text AS day FROM hustle_listings WHERE id = ${listingId} FOR UPDATE
      `;
      if (!l || l.day !== date) return { error: "This shop isn't selling today." };
      const seller = (await getBusinessById(tx, l.business_id))!;
      const [owner] = await tx<{ is_flagged: boolean; is_banned: boolean }[]>`SELECT is_flagged, is_banned FROM users WHERE id = ${seller.owner_user_id}`;
      if (seller.status === "closed" || seller.trading_frozen || owner.is_flagged || owner.is_banned) return { error: "This shop isn't selling right now." };
      if (seller.owner_user_id === user.id) return { error: "You can't buy from your own business." };
      if (seller.state !== user.state) return { error: `You can only buy from businesses in ${user.state ?? "your state"} for now.` };
      if (l.units < qty) return { error: l.units === 0 ? "Sold out for today. Try another shop." : `Only ${l.units} left.` };

      const [{ n }] = await tx<{ n: number }[]>`
        SELECT count(*)::int AS n FROM hustle_orders
        WHERE buyer_user_id = ${user.id} AND seller_business_id = ${seller.id} AND created_at >= ${lagosDayStart(date)} AND status = 'done'
      `;
      if (n >= MAX_DAILY_FROM_SELLER) return { error: `You've bought from ${seller.name} ${MAX_DAILY_FROM_SELLER} times today. Try another shop.` };

      const t = (await getType(tx, seller.type_slug))!;
      const mine = await getBusinessByOwner(tx, user.id, true);
      const myType = mine ? await getType(tx, mine.type_slug) : null;
      const mode = buyMode(t, myType);
      if (!mode) return { error: t.kind === "supplier" ? `Only businesses that use ${t.name.toLowerCase()} supplies can order here.` : "You can't buy this." };
      if (mode !== "need" && mine?.trading_frozen) return { error: "Your business is paused for a check. Message the Kopamate team." };

      const total = qty * l.price;
      let need: NeedKey | null = null;
      if (mode === "need") {
        if (qty !== 1) return { error: "Buy one at a time." };
        need = t.need_key as NeedKey;
        // Buying before it's due is fine: it resets the timer to a full interval from now (it never stacks).
        // Abuse is held back by the per-seller daily limit and the admin trade flags, not by refusing.
        await ensureWallet(tx, user.id);
        await move(tx, wallet(user.id), bizPot(seller.id), total, "purchase_need", { note: seller.name });
        const until = new Date(Date.now() + (t.need_days ?? needFor(need)!.days) * DAY_MS);
        await tx`
          INSERT INTO hustle_needs (user_id, need_key, last_satisfied_at, satisfied_until) VALUES (${user.id}, ${need}, now(), ${until})
          ON CONFLICT (user_id, need_key) DO UPDATE SET last_satisfied_at = now(), satisfied_until = EXCLUDED.satisfied_until
        `;
      } else {
        await move(tx, bizPot(mine!.id), bizPot(seller.id), total, "purchase_supply", { note: seller.name });
        if (mode === "supply") {
          await tx`
            INSERT INTO hustle_inventory (business_id, item_type, qty_lots, lot_cost, source, expires_at)
            VALUES (${mine!.id}, ${t.slug}, ${qty}, ${l.price}, ${seller.id}, ${t.expiry_days ? addDays(date, t.expiry_days) : null})
          `;
        } else {
          await applyService(tx, mine!, t.slug, date);
        }
      }

      await tx`UPDATE hustle_listings SET units_available = units_available - ${qty} WHERE id = ${l.id}`;
      await recordPlayerSale(tx, seller, t, qty, total, date);
      const [order] = await tx<{ id: number }[]>`
        INSERT INTO hustle_orders (buyer_kind, buyer_id, buyer_user_id, seller_business_id, listing_id, qty, unit_price, total, need_key)
        VALUES (${mode === "need" ? "user" : "business"}, ${mode === "need" ? user.id : mine!.id}, ${user.id}, ${seller.id}, ${l.id},
                ${qty}, ${l.price}, ${total}, ${need})
        RETURNING id::int AS id
      `;
      const what = `${qty} ${mode === "supply" ? `lot${qty === 1 ? "" : "s"}` : `${t.unit_name}${qty === 1 ? "" : "s"}`}`;
      await tx`
        INSERT INTO notifications (user_id, kind, title, body, url, actor_id)
        VALUES (${seller.owner_user_id}, 'hustle', ${`${user.nickname} bought ${what} from ${seller.name}`},
                ${`+₦${total.toLocaleString("en-NG")} to your business cash.`}, '/hustle', ${user.id})
      `;
      const message =
        mode === "need"
          ? `Bought from ${seller.name}. ${needFor(need!)!.label} sorted.`
          : mode === "supply"
            ? `${what} added to your stock.`
            : `Done: ${SERVICE_EFFECT[t.slug] ?? "service bought"}.`;
      return { ok: true, orderId: order.id, message } as const;
    });
  } catch (err) {
    if (err instanceof NotEnoughMoney) {
      return {
        error:
          err.pot.kind === "wallet"
            ? "Not enough in your wallet. Pay yourself from your business or wait for Allawee."
            : "Not enough business cash. Invest from your wallet first.",
      };
    }
    throw err;
  }
}

/** The backup shop: always there for a need, but dearer, and it only lasts half as long. */
export async function backupPrice(db: Db, need: NeedKey) {
  const n = needFor(need)!;
  const [t] = await db<{ price: number; days: number }[]>`
    SELECT default_price AS price, coalesce(need_days, ${n.days}) AS days FROM hustle_business_types
    WHERE slug = ANY(${n.types as unknown as string[]}) ORDER BY default_price LIMIT 1
  `;
  const s = await getHustleSettings(db as typeof sql);
  return { price: Math.round(t.price * (1 + s.backupMarkup)), days: Math.max(1, Math.floor(t.days / 2)) };
}

export async function buyBackup(user: { id: string; state: string | null; is_flagged: boolean }, need: NeedKey): Promise<BuyResult> {
  if (!NEEDS.some((n) => n.key === need)) return { error: "Pick a need." };
  try {
    return await transaction(async (tx) => {
      // Only when no player sells it in the state today.
      const n = needFor(need)!;
      const [open] = await tx`
        SELECT 1 FROM hustle_listings l JOIN hustle_businesses b ON b.id = l.business_id
        WHERE l.day_date = ${lagosDate()}::date AND l.units_available > 0 AND b.state = ${user.state} AND b.owner_user_id <> ${user.id}
          AND b.type_slug = ANY(${n.types as unknown as string[]}) AND NOT b.trading_frozen LIMIT 1
      `;
      if (open) return { error: "A player sells this today. Buy from them instead: it's cheaper." };
      const p = await backupPrice(tx, need);
      await ensureWallet(tx, user.id);
      await move(tx, wallet(user.id), SYSTEM, p.price, "backup_market", { source: need, note: `Backup shop · ${n.label}` });
      const until = new Date(Date.now() + p.days * DAY_MS);
      await tx`
        INSERT INTO hustle_needs (user_id, need_key, last_satisfied_at, satisfied_until) VALUES (${user.id}, ${need}, now(), ${until})
        ON CONFLICT (user_id, need_key) DO UPDATE SET last_satisfied_at = now(), satisfied_until = EXCLUDED.satisfied_until
      `;
      const [o] = await tx<{ id: number }[]>`
        INSERT INTO hustle_orders (buyer_kind, buyer_id, buyer_user_id, qty, unit_price, total, need_key)
        VALUES ('user', ${user.id}, ${user.id}, 1, ${p.price}, ${p.price}, ${need}) RETURNING id::int AS id
      `;
      return { ok: true, orderId: o.id, message: `${n.label} sorted from the backup shop.` } as const;
    });
  } catch (err) {
    if (err instanceof NotEnoughMoney) return { error: "Not enough in your wallet. Pay yourself from your business or wait for Allawee." };
    throw err;
  }
}

/** Short reviews only, and no bad words or links. */
export function cleanReview(raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = (raw || "").trim().replace(/\s+/g, " ");
  if (!value) return { ok: true, value: null };
  if (value.length > 140) return { ok: false, error: "Keep it under 140 characters." };
  if (/https?:|www\.|\.com\b/i.test(value)) return { ok: false, error: "No links in reviews." };
  const words = value.toLowerCase().split(/[^a-z]+/);
  const squashed = value.toLowerCase().replace(/[^a-z]/g, "");
  if (BLOCKED_WORDS.some((w) => (w.length <= 4 ? words.includes(w) : squashed.includes(w)))) return { ok: false, error: "Please keep it friendly." };
  return { ok: true, value };
}

/** One review per order, by the buyer. The rating moves a tenth of the way towards the stars given. */
export async function submitReview(userId: string, orderId: number, stars: number, text: string): Promise<{ ok: true } | { error: string }> {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { error: "Tap 1 to 5 stars." };
  const clean = cleanReview(text);
  if (!clean.ok) return { error: clean.error };
  return transaction(async (tx) => {
    const [o] = await tx<{ seller: string | null }[]>`
      SELECT seller_business_id AS seller FROM hustle_orders WHERE id = ${orderId} AND buyer_user_id = ${userId} AND status = 'done'
    `;
    if (!o?.seller) return { error: "You can only review a shop you bought from." };
    const [added] = await tx`
      INSERT INTO hustle_reviews (business_id, reviewer_user_id, order_id, stars, text)
      VALUES (${o.seller}, ${userId}, ${orderId}, ${stars}, ${clean.value}) ON CONFLICT (order_id) DO NOTHING RETURNING 1
    `;
    if (!added) return { error: "You've already reviewed this order." };
    await tx`
      UPDATE hustle_businesses SET rating = least(5, greatest(1, rating + (${stars} - rating) * 0.1)), rating_count = rating_count + 1
      WHERE id = ${o.seller}
    `;
    return { ok: true } as const;
  });
}

/**
 * At close, upkeep and marketing go to a player business of the right type in the same state that opened that
 * day (a real sale for them), picked the same way on every rerun. Returns the provider's id, or null for backup.
 */
export async function upkeepProvider(tx: Tx, b: Pick<Business, "id" | "state">, providerType: string, date: string) {
  const rows = await tx<{ id: string }[]>`
    SELECT p.id FROM hustle_businesses p JOIN hustle_days d ON d.business_id = p.id AND d.day_date = ${date}::date AND d.opened_at IS NOT NULL
    JOIN users u ON u.id = p.owner_user_id
    WHERE p.state = ${b.state} AND p.type_slug = ${providerType} AND p.id <> ${b.id} AND p.status <> 'closed'
      AND NOT p.trading_frozen AND NOT u.is_flagged AND NOT u.is_banned
    ORDER BY p.id
  `;
  if (!rows.length) return null;
  return rows[hash32(`${b.id}|${date}|${providerType}`) % rows.length].id;
}

export async function payProvider(tx: Tx, from: Business, providerId: string, amount: number, reason: "upkeep" | "marketing", date: string) {
  await move(tx, bizPot(from.id), bizPot(providerId), amount, reason, { allowNegative: true, ref: date, note: from.name });
  await tx`
    UPDATE hustle_days SET revenue = revenue + ${amount}, profit = CASE WHEN closed_at IS NULL THEN profit ELSE profit + ${amount} END
    WHERE business_id = ${providerId} AND day_date = ${date}::date
  `;
}
