import "server-only";
import type postgres from "postgres";
import { sql, transaction } from "../db";
import { lagosDate } from "../util";
import {
  activeEvents, activeModifiers, addDays, cardFor, daysBetween, eventFactor, getBusinessById, getType, resolveEffects,
  rivalsFor, startDay, type Db, type MarketEvent,
} from "./data";
import { dayTips, priceBounds, priceStep, priceWeight, ratingFactor, seeded, townCustomers, vibeFactor, withNoise, type Tip } from "./engine";
import { business as bizPot, move, NotEnoughMoney, SYSTEM } from "./ledger";
import { getVibe } from "./needs";
import { payProvider, upkeepProvider } from "./trade";
import { getHustleSettings, type HustleSettings } from "./settings";
import type { Business, BusinessType, CardEffects, DayPlan } from "./types";

type Tx = postgres.ReservedSql;

/** Below this a business is restructured: cash back to RESTART_CASH, stage 1, and a Comeback badge. */
export const RESTRUCTURE_BELOW = -10_000;
export const RESTART_CASH = 10_000;
/** "Hot" types get this much extra townspeople demand for their first 14 days. */
export const HOT_BONUS = 1.2;

/** What one unit costs in supplies and running costs, from the type config and the supply type's lot price. */
export function unitCosts(t: BusinessType, supply: BusinessType | null, s: HustleSettings, costFactor: number) {
  const upl = t.units_per_supply_lot ?? 0;
  const normalLot = supply?.default_price ?? 0;
  const backupLot = Math.round(normalLot * (1 + s.backupMarkup));
  const supplyShare = supply && upl ? normalLot / upl : 0;
  const running = Math.round(Math.max(0, t.cost_per_unit - supplyShare) * costFactor);
  return { upl, normalLot, backupLot, running };
}

/** Cards are written for any business: "{unit}" and "{units}" become "plate" and "plates". */
export const cardText = (text: string, t: Pick<BusinessType, "unit_name">) =>
  text.replaceAll("{units}", `${t.unit_name}s`).replaceAll("{unit}", t.unit_name);

/** Whether this business consumes its supplies when it prepares (food that spoils) or only when it sells. */
const consumesAtOpen = (t: BusinessType) => t.kind !== "supplier" && t.perishable;

export type PlanContext = {
  business: Business;
  type: BusinessType;
  date: string;
  dayNo: number;
  alreadyOpen: boolean;
  bounds: { min: number; max: number };
  step: number;
  capacity: number;
  /** Customers from town at the reference price, before price and rivals (all other factors applied). */
  base: number;
  refPrice: number;
  rivalsWeight: number;
  rivalCount: number;
  rivalLow: number | null;
  rivalHigh: number | null;
  card: { id: number; slug: string | null; prompt: string; options: string[] } | null;
  events: { headline: string; body: string }[];
  supplyName: string | null;
  inventoryLots: number;
  /** Average cost of a lot in stock (player lots are usually cheaper than backup). */
  stockLotCost: number;
  suppliers: { listingId: number; name: string; slug: string; icon: string; color: string; rating: number; price: number; left: number }[];
  upl: number;
  normalLot: number;
  backupLot: number;
  running: number;
  fixed: number;
  modLabels: string[];
};

async function inventoryLots(db: Db, businessId: string, item: string, date: string) {
  const [r] = await db<{ n: number }[]>`
    SELECT coalesce(sum(qty_lots), 0)::float8 AS n FROM hustle_inventory
    WHERE business_id = ${businessId} AND item_type = ${item} AND qty_lots > 0 AND (expires_at IS NULL OR expires_at >= ${date}::date)
  `;
  return r.n;
}

type Ctx = {
  t: BusinessType;
  supply: BusinessType | null;
  s: HustleSettings;
  events: MarketEvent[];
  costFactor: number;
  mods: Awaited<ReturnType<typeof activeModifiers>>;
  base: number;
  rivalsWeight: number;
  rivalPrices: number[];
};

async function marketContext(db: Db, b: Business, date: string): Promise<Ctx> {
  const t = (await getType(db, b.type_slug))!;
  const [supply, s, events, mods, rivals, vibe] = await Promise.all([
    t.supply_type ? getType(db, t.supply_type) : Promise.resolve(null),
    getHustleSettings(db as typeof sql),
    activeEvents(db, b.state, date),
    activeModifiers(db, b.id, date),
    rivalsFor(db, b, date),
    getVibe(db, b.owner_user_id),
  ]);
  const hot = b.hot_until && b.hot_until >= date ? HOT_BONUS : 1;
  const base =
    (t.townspeople_demand_per_day * s.townMultiplier * eventFactor(events, t, "demand") * hot * mods.demand / t.default_price) *
    ratingFactor(b.rating) *
    vibeFactor(vibe, s.needVibeEffect);
  const rivalPrices = rivals.map((r) => r.price).filter((p) => p > 0);
  return {
    t, supply, s, events, mods, base,
    costFactor: eventFactor(events, t, "cost"),
    rivalsWeight: rivalPrices.reduce((sum, p) => sum + priceWeight(t.default_price, p), 0),
    rivalPrices,
  };
}

function fixedCosts(t: BusinessType, c: Pick<Ctx, "costFactor" | "mods">) {
  return t.rent_per_day + Math.round(t.upkeep_per_day * c.costFactor) + t.marketing_per_day + Math.round(c.mods.dailyCost);
}

export async function getPlanContext(b: Business, date = lagosDate()): Promise<PlanContext> {
  const c = await marketContext(sql, b, date);
  const { t } = c;
  const [card, [day], [stock], suppliers] = await Promise.all([
    cardFor(sql, b, date),
    sql<{ opened: boolean }[]>`SELECT opened_at IS NOT NULL AS opened FROM hustle_days WHERE business_id = ${b.id} AND day_date = ${date}::date`,
    sql<{ lots: number; value: number }[]>`
      SELECT coalesce(sum(qty_lots), 0)::float8 AS lots, coalesce(sum(qty_lots * lot_cost), 0)::float8 AS value FROM hustle_inventory
      WHERE business_id = ${b.id} AND item_type = ${t.supply_type ?? ""} AND qty_lots > 0 AND (expires_at IS NULL OR expires_at >= ${date}::date)
    `,
    t.supply_type
      ? sql<PlanContext["suppliers"]>`
          SELECT l.id::int AS "listingId", s.name, s.slug, s.icon, s.color, s.rating::float8 AS rating, l.price, l.units_available AS "left"
          FROM hustle_listings l JOIN hustle_businesses s ON s.id = l.business_id JOIN users u ON u.id = s.owner_user_id
          WHERE l.day_date = ${date}::date AND l.units_available > 0 AND s.type_slug = ${t.supply_type} AND s.state = ${b.state}
            AND s.id <> ${b.id} AND NOT s.trading_frozen AND NOT u.is_flagged AND NOT u.is_banned
          ORDER BY l.price, s.rating DESC LIMIT 5
        `
      : Promise.resolve([]),
  ]);
  const costs = unitCosts(t, c.supply, c.s, c.costFactor);
  return {
    business: b,
    type: t,
    date,
    dayNo: daysBetween(startDay(b), date) + 1,
    alreadyOpen: Boolean(day?.opened),
    bounds: priceBounds(t),
    step: priceStep(t.default_price),
    capacity: Math.max(1, Math.floor(t.capacity_per_day * c.mods.capacity)),
    base: c.base,
    refPrice: t.default_price,
    rivalsWeight: c.rivalsWeight,
    rivalCount: c.rivalPrices.length,
    rivalLow: c.rivalPrices.length ? Math.min(...c.rivalPrices) : null,
    rivalHigh: c.rivalPrices.length ? Math.max(...c.rivalPrices) : null,
    card: card ? { id: card.id, slug: card.slug, prompt: cardText(card.prompt, t), options: card.options.map((o) => cardText(o.label, t)) } : null,
    events: c.events.map((e) => ({ headline: e.headline, body: e.body })),
    supplyName: c.supply?.name ?? null,
    inventoryLots: stock.lots,
    stockLotCost: stock.lots > 0 ? Math.round(stock.value / stock.lots) : 0,
    suppliers,
    ...costs,
    fixed: fixedCosts(t, c),
    modLabels: c.mods.labels,
  };
}

/** Takes `lots` from inventory, oldest first (skipping expired ones). Returns what they cost and how many were missing. */
async function consumeLots(tx: Tx, businessId: string, item: string, lots: number, date: string) {
  let need = lots;
  let cost = 0;
  let playerLots = 0;
  let playerCost = 0;
  const rows = await tx<{ id: number; qty: number; lot_cost: number; source: string }[]>`
    SELECT id, qty_lots::float8 AS qty, lot_cost, source FROM hustle_inventory
    WHERE business_id = ${businessId} AND item_type = ${item} AND qty_lots > 0 AND (expires_at IS NULL OR expires_at >= ${date}::date)
    ORDER BY acquired_at, id FOR UPDATE
  `;
  for (const r of rows) {
    if (need <= 1e-9) break;
    const take = Math.min(r.qty, need);
    await tx`UPDATE hustle_inventory SET qty_lots = greatest(0, qty_lots - ${take}) WHERE id = ${r.id}`;
    cost += take * r.lot_cost;
    if (r.source !== "backup") {
      playerLots += take;
      playerCost += take * r.lot_cost;
    }
    need -= take;
  }
  return { cost: Math.round(cost), missing: Math.max(0, need), playerLots, playerCost };
}

/** Buys whole lots from the backup market (or at a discount, from a decision card) into inventory. */
async function buyBackupLots(tx: Tx, b: Business, supply: BusinessType, lots: number, lotPrice: number, date: string, allowNegative = false) {
  if (lots <= 0) return 0;
  const total = lots * lotPrice;
  await move(tx, bizPot(b.id), SYSTEM, total, "backup_market", { source: supply.slug, allowNegative, note: `${lots} lots` });
  await tx`
    INSERT INTO hustle_inventory (business_id, item_type, qty_lots, lot_cost, source, expires_at)
    VALUES (${b.id}, ${supply.slug}, ${lots}, ${lotPrice}, 'backup', ${supply.expiry_days ? addDays(date, supply.expiry_days) : null})
  `;
  return total;
}

/**
 * Records `qty` units sold (to town or to a player) for a business that pays per sale: uses up supplies and pays
 * running costs. Perishable food and suppliers paid everything when they prepared, so this does nothing for them.
 * Returns the cost of goods for these units. Never refuses a sale: missing supplies are bought from backup.
 */
export async function costOfSale(tx: Tx, b: Business, t: BusinessType, supply: BusinessType | null, s: HustleSettings, costFactor: number, qty: number, date: string) {
  if (qty <= 0 || consumesAtOpen(t) || t.kind === "supplier") return { cogs: 0, extra: 0 };
  const costs = unitCosts(t, supply, s, costFactor);
  let cogs = 0;
  let extra = 0;
  if (supply && costs.upl) {
    const used = await consumeLots(tx, b.id, supply.slug, qty / costs.upl, date);
    cogs += used.cost;
    if (used.missing > 0) {
      const lots = Math.ceil(used.missing - 1e-9);
      await buyBackupLots(tx, b, supply, lots, costs.backupLot, date, true);
      const more = await consumeLots(tx, b.id, supply.slug, used.missing, date);
      cogs += more.cost;
      extra += Math.round(used.missing * (costs.backupLot - costs.normalLot));
    }
  }
  const running = qty * costs.running;
  await move(tx, bizPot(b.id), SYSTEM, running, "running_cost", { allowNegative: true });
  return { cogs: cogs + running, extra };
}

export type OpenResult = { ok: true; date: string } | { error: string };

/** Opens today's shop with the owner's plan. All maths and money happen here, in one transaction. */
export async function openDay(userId: string, plan: DayPlan): Promise<OpenResult> {
  const date = lagosDate();
  try {
    return await transaction(async (tx) => {
      const [own] = await tx<{ id: string }[]>`SELECT id FROM hustle_businesses WHERE owner_user_id = ${userId} FOR UPDATE`;
      if (!own) return { error: "Start a business first." };
      await closeThrough(tx, own.id, addDays(date, -1));
      const b = (await getBusinessById(tx, own.id))!;
      if (b.status === "closed") return { error: "This business is closed." };
      if (b.trading_frozen) return { error: "Your business is paused for a check. Message the Kopamate team." };

      const [existing] = await tx`SELECT opened_at FROM hustle_days WHERE business_id = ${b.id} AND day_date = ${date}::date`;
      if (existing?.opened_at) return { error: "Your shop is already open today. Come back tomorrow to plan again." };

      const c = await marketContext(tx, b, date);
      const { t, supply, s } = c;
      const capacity = Math.max(1, Math.floor(t.capacity_per_day * c.mods.capacity));
      const bounds = priceBounds(t);
      if (!Number.isInteger(plan.units) || plan.units < 0 || plan.units > capacity) return { error: `Prepare between 0 and ${capacity}.` };
      if (!Number.isInteger(plan.price) || plan.price < bounds.min || plan.price > bounds.max) {
        return { error: `Set a price between ₦${bounds.min.toLocaleString("en-NG")} and ₦${bounds.max.toLocaleString("en-NG")}.` };
      }
      const card = await cardFor(tx, b, date);
      if (card && (plan.card !== card.id || plan.choice === null || !card.options[plan.choice])) return { error: "Make today's decision first." };
      const effects: CardEffects = card && plan.choice !== null ? resolveEffects(card.options[plan.choice].effects, b.id, date) : {};

      const costs = unitCosts(t, supply, s, c.costFactor);
      const price = effects.price ? Math.max(bounds.min, Math.round((plan.price * effects.price) / 10) * 10) : plan.price;
      const units = plan.units;
      let cogs = 0;
      let supplyExtra = 0;
      let playerSaved = 0;

      // A decision card's discounted lots go into stock first, so today can use them.
      if (effects.buy_lots && supply) {
        await buyBackupLots(tx, b, supply, effects.buy_lots.lots, Math.round(costs.normalLot * (1 - effects.buy_lots.discount)), date);
      }

      if (t.kind === "supplier") {
        // Producing lots: the production cost is paid now.
        const produce = units * Math.round(t.cost_per_unit * c.costFactor);
        await move(tx, bizPot(b.id), SYSTEM, produce, "running_cost", { note: `${units} lots` });
        cogs += produce;
      } else if (supply && costs.upl && units > 0) {
        const lotsNeeded = units / costs.upl;
        const have = await inventoryLots(tx, b.id, supply.slug, date);
        const buy = Math.max(0, Math.ceil(lotsNeeded - have - 1e-9));
        await buyBackupLots(tx, b, supply, buy, costs.backupLot, date);
        supplyExtra += Math.round(Math.min(buy, Math.max(0, lotsNeeded - have)) * (costs.backupLot - costs.normalLot));
        if (consumesAtOpen(t)) {
          const used = await consumeLots(tx, b.id, supply.slug, lotsNeeded, date);
          cogs += used.cost;
          playerSaved += Math.round(used.playerLots * costs.backupLot - used.playerCost);
        }
      }
      if (consumesAtOpen(t) && units > 0) {
        await move(tx, bizPot(b.id), SYSTEM, units * costs.running, "running_cost");
        cogs += units * costs.running;
      }

      // Credit: those units go to a regular now, and the money comes later (maybe).
      const creditUnits = effects.credit ? Math.min(effects.credit.units, units) : 0;
      if (creditUnits > 0 && effects.credit) {
        const sale = await costOfSale(tx, b, t, supply, s, c.costFactor, creditUnits, date);
        cogs += sale.cogs;
        await tx`
          INSERT INTO hustle_receivables (business_id, amount, due_on, from_label, repay_chance, created_on)
          VALUES (${b.id}, ${creditUnits * price}, ${addDays(date, effects.credit.due_days)}, 'A regular', ${effects.credit.repay_chance}, ${date})
        `;
      }
      const forSale = units - creditUnits;

      // Townspeople: customers at this price, shared with rivals, ±10% seeded noise.
      const came = withNoise(townCustomers(c.base, t.default_price, price, c.rivalsWeight) * (effects.demand ?? 1), b.id, date);
      const soldTown = Math.min(came, forSale);
      const revenue = soldTown * price;
      await move(tx, SYSTEM, bizPot(b.id), revenue, "townspeople", { note: `${soldTown} ${t.unit_name}` });
      const sale = await costOfSale(tx, b, t, supply, s, c.costFactor, soldTown, date);
      cogs += sale.cogs;
      supplyExtra += sale.extra;

      // The card's cash effects (levy, generator fuel, a refund).
      let other = effects.cash ?? 0;
      if (effects.refund_units) other -= effects.refund_units * price;
      if (other < 0) await move(tx, bizPot(b.id), SYSTEM, -other, "decision", { allowNegative: true, note: card?.slug ?? undefined });
      else if (other > 0) await move(tx, SYSTEM, bizPot(b.id), other, "decision", { note: card?.slug ?? undefined });

      for (const m of effects.modifiers ?? []) {
        await tx`
          INSERT INTO hustle_modifiers (business_id, kind, value, starts_on, ends_on, label)
          VALUES (${b.id}, ${m.kind}, ${m.value}, ${addDays(date, 1)}, ${addDays(date, m.days)}, ${m.label})
        `;
      }
      const ratingDelta = effects.rating ?? 0;
      if (ratingDelta) await tx`UPDATE hustle_businesses SET rating = least(5, greatest(1, rating + ${ratingDelta})) WHERE id = ${b.id}`;

      await tx`
        INSERT INTO hustle_listings (business_id, day_date, units_available, price)
        VALUES (${b.id}, ${date}, ${forSale - soldTown}, ${price})
        ON CONFLICT (business_id, day_date) DO UPDATE SET units_available = EXCLUDED.units_available, price = EXCLUDED.price
      `;
      const soldCost = consumesAtOpen(t) || t.kind === "supplier" ? cogs / Math.max(1, units) : cogs / Math.max(1, soldTown + creditUnits);
      const tips = dayTips({
        unit: t.unit_name,
        units,
        capacity,
        price,
        wasted: 0,
        wasteCost: 0,
        turnedAway: Math.max(0, came - soldTown),
        rivalLow: c.rivalPrices.length ? Math.min(...c.rivalPrices) : null,
        rivalHigh: c.rivalPrices.length ? Math.max(...c.rivalPrices) : null,
        refPrice: t.default_price,
        marginPerUnit: Math.round(price - soldCost),
        supplyExtra,
        playerSaved,
        credit: creditUnits > 0 ? { units: creditUnits, amount: creditUnits * price } : null,
        creditDeclined: card?.slug === "credit" && !effects.credit,
        slots: false,
        unusedSlots: 0,
      });
      const storedPlan = { units, price, set_price: plan.price, card: card?.id ?? null, card_slug: card?.slug ?? null, choice: plan.choice, effects, player_saved: playerSaved };
      await tx`
        INSERT INTO hustle_days (business_id, day_date, plan, opened_at, units_prepared, units_credit, units_sold_town, town_demand,
                                 revenue, cost_of_goods, other, rating_delta, supply_extra, tips)
        VALUES (${b.id}, ${date}, ${tx.json(storedPlan)}, now(), ${units}, ${creditUnits}, ${soldTown}, ${came},
                ${revenue}, ${cogs}, ${other}, ${ratingDelta}, ${supplyExtra}, ${tx.json(tips)})
        ON CONFLICT (business_id, day_date) DO UPDATE SET plan = EXCLUDED.plan, opened_at = EXCLUDED.opened_at,
          units_prepared = EXCLUDED.units_prepared, units_credit = EXCLUDED.units_credit, units_sold_town = EXCLUDED.units_sold_town,
          town_demand = EXCLUDED.town_demand, revenue = EXCLUDED.revenue, cost_of_goods = EXCLUDED.cost_of_goods,
          other = EXCLUDED.other, rating_delta = EXCLUDED.rating_delta, supply_extra = EXCLUDED.supply_extra, tips = EXCLUDED.tips
      `;
      return { ok: true, date } as const;
    });
  } catch (err) {
    if (err instanceof NotEnoughMoney) {
      return { error: "Not enough business cash for that many. Prepare fewer, or invest from your wallet." };
    }
    throw err;
  }
}

/** Closes one business day: spoilage, salvage, rent and upkeep, final profit, rating and tips. Idempotent. */
async function closeDay(tx: Tx, b: Business, date: string) {
  const [row] = await tx<{ opened: boolean; closed: boolean }[]>`
    SELECT opened_at IS NOT NULL AS opened, closed_at IS NOT NULL AS closed FROM hustle_days
    WHERE business_id = ${b.id} AND day_date = ${date}::date FOR UPDATE
  `;
  if (row?.closed) return;
  if (!row) await tx`INSERT INTO hustle_days (business_id, day_date) VALUES (${b.id}, ${date})`;
  const c = await marketContext(tx, b, date);
  const { t, s } = c;
  let fixed = 0;
  let salvage = 0;
  let wasted = 0;

  const [listing] = await tx<{ left: number; price: number }[]>`
    SELECT units_available AS left, price FROM hustle_listings WHERE business_id = ${b.id} AND day_date = ${date}::date
  `;
  const left = listing?.left ?? 0;
  if (row?.opened) {
    if (t.kind === "supplier" && left > 0) {
      // Unsold lots go to middlemen at a discount.
      salvage = Math.round(left * listing.price * s.salvagePct);
      await move(tx, SYSTEM, bizPot(b.id), salvage, "spoilage_salvage", { note: `${left} lots` });
    } else if (t.perishable) {
      wasted = left;
    }
    const upkeep = Math.round(t.upkeep_per_day * c.costFactor);
    await move(tx, bizPot(b.id), SYSTEM, t.rent_per_day, "rent", { allowNegative: true, ref: date });
    // Upkeep goes to a player of the provider type who opened today, if there is one (a real sale for them);
    // marketing to a content creator the same way. Otherwise both go to the backup market.
    const upkeepTo = t.upkeep_provider_type && upkeep > 0 ? await upkeepProvider(tx, b, t.upkeep_provider_type, date) : null;
    if (upkeepTo) await payProvider(tx, b, upkeepTo, upkeep, "upkeep", date);
    else await move(tx, bizPot(b.id), SYSTEM, upkeep, "upkeep", { allowNegative: true, ref: date, source: t.upkeep_provider_type ?? undefined });
    const marketingTo = t.marketing_per_day > 0 ? await upkeepProvider(tx, b, "content_creator", date) : null;
    if (marketingTo) await payProvider(tx, b, marketingTo, t.marketing_per_day, "marketing", date);
    else await move(tx, bizPot(b.id), SYSTEM, t.marketing_per_day, "marketing", { allowNegative: true, ref: date });
    await move(tx, bizPot(b.id), SYSTEM, Math.round(c.mods.dailyCost), "running_cost", { allowNegative: true, ref: date, note: "daily" });
    fixed = t.rent_per_day + upkeep + t.marketing_per_day + Math.round(c.mods.dailyCost);
  } else if (daysBetween(startDay(b), date) >= s.graceDays) {
    // Closed all day: rent is still due (free in the first grace days).
    await move(tx, bizPot(b.id), SYSTEM, t.rent_per_day, "rent", { allowNegative: true, ref: date });
    fixed = t.rent_per_day;
  }
  if (listing) await tx`UPDATE hustle_listings SET units_available = 0 WHERE business_id = ${b.id} AND day_date = ${date}::date`;

  const [d] = await tx<{ units: number; credit: number; town: number; players: number; came: number; revenue: number; cogs: number; other: number; extra: number; plan: { price: number; set_price?: number; card_slug?: string | null; effects?: CardEffects; player_saved?: number } | null; rating_delta: number }[]>`
    UPDATE hustle_days SET units_wasted = ${wasted}, revenue = revenue + ${salvage}, fixed_costs = ${fixed}
    WHERE business_id = ${b.id} AND day_date = ${date}::date
    RETURNING units_prepared AS units, units_credit AS credit, units_sold_town AS town, units_sold_players AS players,
      town_demand AS came, revenue::float8 AS revenue, cost_of_goods::float8 AS cogs, other::float8 AS other,
      supply_extra::float8 AS extra, plan, rating_delta::float8 AS rating_delta
  `;
  const profit = d.revenue - d.cogs - fixed + d.other;
  let ratingDelta = 0;
  let tips: Tip[] = [];
  if (row?.opened && d.plan) {
    const turnedAway = Math.max(0, d.came - d.town);
    if (turnedAway >= 2) ratingDelta -= 0.05;
    else if (wasted === 0 && d.town + d.players > 0) ratingDelta += 0.02;
    const costs = unitCosts(t, c.supply, s, c.costFactor);
    const perUnitCost = d.units > 0 ? d.cogs / Math.max(1, t.kind === "supplier" || t.perishable ? d.units : d.town + d.players + d.credit) : 0;
    const credit = d.plan.effects?.credit ? { units: d.credit, amount: d.credit * d.plan.price } : null;
    tips = dayTips({
      unit: t.unit_name,
      units: d.units,
      capacity: Math.max(1, Math.floor(t.capacity_per_day * c.mods.capacity)),
      price: d.plan.price,
      wasted,
      wasteCost: Math.round(wasted * (costs.normalLot && costs.upl ? costs.normalLot / costs.upl + costs.running : costs.running)),
      turnedAway,
      rivalLow: c.rivalPrices.length ? Math.min(...c.rivalPrices) : null,
      rivalHigh: c.rivalPrices.length ? Math.max(...c.rivalPrices) : null,
      refPrice: t.default_price,
      marginPerUnit: Math.round(d.plan.price - perUnitCost),
      supplyExtra: d.extra,
      playerSaved: d.plan.player_saved ?? 0,
      credit: credit && credit.units > 0 ? credit : null,
      creditDeclined: d.plan.card_slug === "credit" && !d.plan.effects?.credit,
      slots: t.slots,
      unusedSlots: t.slots ? Math.max(0, d.units - d.credit - d.town - d.players) : 0,
    });
  }
  if (ratingDelta) await tx`UPDATE hustle_businesses SET rating = least(5, greatest(1, rating + ${ratingDelta})) WHERE id = ${b.id}`;
  await tx`
    UPDATE hustle_days SET profit = ${profit}, rating_delta = rating_delta + ${ratingDelta}, tips = ${tx.json(tips)}, closed_at = now()
    WHERE business_id = ${b.id} AND day_date = ${date}::date
  `;
  if (row?.opened) {
    const sign = profit < 0 ? "−" : "+";
    await tx`
      INSERT INTO notifications (user_id, kind, title, body, url)
      VALUES (${b.owner_user_id}, 'hustle', ${`Day ${daysBetween(startDay(b), date) + 1} results are ready: ${sign}₦${Math.abs(profit).toLocaleString("en-NG")}`},
              ${`${b.name}: see what happened and why.`}, ${`/hustle/day/${date}`})
    `;
  }
}

/** Repays (or not) credit that's due by `date`, by the card's chance, seeded so it never changes on a rerun. */
async function settleReceivables(tx: Tx, businessId: string, date: string) {
  const due = await tx<{ id: number; amount: number; chance: number }[]>`
    SELECT id, amount::float8 AS amount, repay_chance::float8 AS chance FROM hustle_receivables
    WHERE business_id = ${businessId} AND status = 'pending' AND due_on <= ${date}::date FOR UPDATE
  `;
  for (const r of due) {
    const paid = seeded(businessId, String(r.id), "repay") < r.chance;
    await tx`UPDATE hustle_receivables SET status = ${paid ? "paid" : "defaulted"} WHERE id = ${r.id}`;
    if (paid) {
      await move(tx, SYSTEM, bizPot(businessId), r.amount, "credit_repaid", { ref: r.id });
      await tx`UPDATE hustle_days SET other = other + ${r.amount}, profit = profit + ${r.amount} WHERE business_id = ${businessId} AND day_date = ${date}::date`;
    }
  }
}

/** Deep in the red: a fresh start at stage 1 with a little cash, and a Comeback badge. */
async function maybeRestructure(tx: Tx, businessId: string, ownerId: string) {
  const [b] = await tx<{ cash: number }[]>`SELECT cash::float8 AS cash FROM hustle_businesses WHERE id = ${businessId}`;
  if (b.cash >= RESTRUCTURE_BELOW) return false;
  await move(tx, SYSTEM, bizPot(businessId), RESTART_CASH - b.cash, "restructure");
  await tx`UPDATE hustle_businesses SET status = 'restructured', stage = 1, restructures = restructures + 1 WHERE id = ${businessId}`;
  await tx`
    INSERT INTO user_badges (user_id, badge_slug) VALUES (${ownerId}, 'hustle_comeback') ON CONFLICT (user_id, badge_slug) DO NOTHING
  `;
  await tx`
    INSERT INTO notifications (user_id, kind, title, body, url)
    VALUES (${ownerId}, 'hustle', 'Your business was restructured', ${`Debts cleared and ₦${RESTART_CASH.toLocaleString("en-NG")} to start again. Plan carefully.`}, '/hustle')
  `;
  return true;
}

/**
 * Closes every business day from the last closed one up to `through` (normally yesterday), then settles credit,
 * clears expired stock and restructures if needed. Locks the business, so the cron and a page view can both call
 * it at once safely. Safe to call any number of times.
 */
export async function closeThrough(tx: Tx, businessId: string, through: string) {
  const b = await getBusinessById(tx, businessId, true);
  if (!b || b.status === "closed") return 0;
  let from = addDays(b.closed_through, 1);
  // Away for months: only the last 60 days are charged.
  if (daysBetween(from, through) > 60) from = addDays(through, -60);
  let n = 0;
  for (let d = from; d <= through; d = addDays(d, 1)) {
    await closeDay(tx, b, d);
    await settleReceivables(tx, b.id, d);
    n++;
  }
  if (n) {
    await tx`UPDATE hustle_businesses SET closed_through = ${through} WHERE id = ${b.id}`;
    await tx`UPDATE hustle_inventory SET qty_lots = 0 WHERE business_id = ${b.id} AND expires_at < ${addDays(through, 1)}::date AND qty_lots > 0`;
    await tx`DELETE FROM hustle_inventory WHERE business_id = ${b.id} AND qty_lots = 0 AND acquired_at < now() - interval '30 days'`;
    await maybeRestructure(tx, b.id, b.owner_user_id);
  }
  return n;
}

/** For pages: closes this user's past days before showing anything. */
export async function catchUp(businessId: string) {
  const yesterday = addDays(lagosDate(), -1);
  const [b] = await sql<{ behind: boolean }[]>`SELECT closed_through < ${yesterday}::date AS behind FROM hustle_businesses WHERE id = ${businessId}`;
  if (b?.behind) await transaction((tx) => closeThrough(tx, businessId, yesterday));
}

/**
 * The cron: closes every business up to yesterday, one transaction each, the furthest behind first. Stops
 * starting new ones once `budgetMs` has passed so the function never hits its time limit mid-write; whatever is
 * left is picked up by the next run (or by the owner's next page view). Returns how many are still behind.
 */
export async function closeAll(through = addDays(lagosDate(), -1), budgetMs = Infinity) {
  const started = Date.now();
  const ids = await sql<{ id: string }[]>`
    SELECT id FROM hustle_businesses WHERE status <> 'closed' AND closed_through < ${through}::date ORDER BY closed_through, id LIMIT 5000
  `;
  let days = 0;
  let failed = 0;
  let done = 0;
  for (const { id } of ids) {
    if (Date.now() - started > budgetMs) break;
    try {
      days += await transaction((tx) => closeThrough(tx, id, through));
    } catch (err) {
      failed++;
      console.error("hustle close failed", id, err);
    }
    done++;
  }
  return { businesses: done, days, failed, left: ids.length - done };
}
