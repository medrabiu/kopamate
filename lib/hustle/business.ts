import "server-only";
import { sql, transaction } from "../db";
import { lagosDate } from "../util";
import { BLOCKED_WORDS } from "../validate";
import { addDays, getType, getTypes, type Db } from "./data";
import { business as bizPot, move, SYSTEM } from "./ledger";
import { getHustleSettings } from "./settings";
import { BIZ_COLORS, BIZ_ICONS, type BusinessType } from "./types";
import { ensureWallet } from "./wallet";

/** Real brands can't be business names: it's a game, and they'd look like the real thing. */
const BRANDS = [
  "dangote", "mtn", "glo", "airtel", "9mobile", "etisalat", "shoprite", "spar", "ebeano", "chickenrepublic", "kfc", "dominos",
  "mrbiggs", "tantalizers", "sweetsensation", "kilimanjaro", "bukkahut", "coldstone", "jumia", "konga", "opay", "moniepoint",
  "palmpay", "kuda", "gtbank", "gtco", "zenith", "firstbank", "accessbank", "uba", "paystack", "flutterwave", "cocacola", "coke",
  "pepsi", "fanta", "indomie", "peakmilk", "dano", "nestle", "unilever", "maggi", "knorr", "apple", "iphone", "samsung", "tecno",
  "infinix", "itel", "nike", "adidas", "gucci", "uber", "bolt", "gokada", "glovo", "chowdeck", "facebook", "instagram", "tiktok",
  "whatsapp", "google", "netflix", "dstv", "gotv", "startimes", "nepa", "phcn", "nnpc", "total", "oando", "mobil", "conoil",
];

export const NAME_RULES = "3 to 30 letters, numbers and spaces";

export function validateBusinessName(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = (raw || "").trim().replace(/\s+/g, " ");
  if (value.length < 3 || value.length > 30) return { ok: false, error: "Business name must be 3 to 30 characters." };
  if (!/^[A-Za-z0-9 '&.\-]+$/.test(value)) return { ok: false, error: "Use letters, numbers, spaces, ' & . or - only." };
  if (!/[A-Za-z]{2}/.test(value)) return { ok: false, error: "Include a real word in the name." };
  const squashed = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const words = value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (BLOCKED_WORDS.some((w) => (w.length <= 4 ? words.includes(w) : squashed.includes(w)))) {
    return { ok: false, error: "Choose a different name." };
  }
  if (BRANDS.some((brand) => (brand.length <= 4 ? words.includes(brand) || squashed === brand : squashed.includes(brand)))) {
    return { ok: false, error: "That looks like a real brand. Use your own business name." };
  }
  return { ok: true, value };
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "shop";
}

export type TypeInState = BusinessType & { count: number; hot: boolean; busy: boolean };

/**
 * Types a new player can start, with how many there are in their state. "Hot": none or one in the state, so
 * the town's customers are barely shared (and new ones get +20% demand for 14 days). "Busy": 3 or more.
 */
export async function typesInState(state: string): Promise<TypeInState[]> {
  const [types, counts] = await Promise.all([
    getTypes(sql, true),
    sql<{ type_slug: string; n: number }[]>`
      SELECT type_slug, count(*)::int AS n FROM hustle_businesses WHERE state = ${state} AND status <> 'closed' GROUP BY type_slug
    `,
  ]);
  const by = new Map(counts.map((c) => [c.type_slug, c.n]));
  return types.map((t) => {
    const count = by.get(t.slug) ?? 0;
    return { ...t, count, hot: count <= 1, busy: count >= 3 };
  });
}

export type StartInput = { type: string; name: string; icon: string; color: string };

export async function startBusiness(userId: string, state: string | null, input: StartInput): Promise<{ ok: true; slug: string } | { error: string }> {
  if (!state) return { error: "Add your state in Profile first. Your business runs there." };
  const name = validateBusinessName(input.name);
  if (!name.ok) return { error: name.error };
  if (!(BIZ_ICONS as readonly string[]).includes(input.icon)) return { error: "Pick a logo." };
  if (!(BIZ_COLORS as readonly string[]).includes(input.color)) return { error: "Pick a colour." };

  return transaction(async (tx) => {
    const t = await getType(tx, input.type);
    if (!t || !t.is_active) return { error: "Pick a business type." };
    const s = await getHustleSettings(tx);
    if (t.setup_cost > s.grant) return { error: "That business costs more than your startup money." };
    const [taken] = await tx`SELECT 1 FROM hustle_businesses WHERE owner_user_id = ${userId}`;
    if (taken) return { error: "You already have a business." };
    const [dupe] = await tx`SELECT 1 FROM hustle_businesses WHERE state = ${state} AND lower(name) = lower(${name.value})`;
    if (dupe) return { error: `There's already a business called ${name.value} in ${state}. Try another name.` };

    const [{ n }] = await tx<{ n: number }[]>`
      SELECT count(*)::int AS n FROM hustle_businesses WHERE state = ${state} AND type_slug = ${t.slug} AND status <> 'closed'
    `;
    const today = lagosDate();
    const base = slugify(name.value);
    let slug = base;
    for (let i = 2; (await tx`SELECT 1 FROM hustle_businesses WHERE slug = ${slug}`).length; i++) slug = `${base}-${i}`;

    await ensureWallet(tx, userId);
    const [b] = await tx<{ id: string }[]>`
      INSERT INTO hustle_businesses (owner_user_id, type_slug, name, slug, icon, color, state, hot_until, closed_through)
      VALUES (${userId}, ${t.slug}, ${name.value}, ${slug}, ${input.icon}, ${input.color}, ${state},
              ${n <= 1 ? addDays(today, 13) : null}, ${addDays(today, -1)})
      RETURNING id
    `;
    // The grant arrives in full, then setup is paid out of it, so both show in the ledger.
    await move(tx, SYSTEM, bizPot(b.id), s.grant, "grant");
    await move(tx, bizPot(b.id), SYSTEM, t.setup_cost, "running_cost", { note: "setup" });
    return { ok: true, slug } as const;
  });
}

export type DaySummary = {
  day_date: string;
  opened: boolean;
  closed: boolean;
  units_prepared: number;
  units_credit: number;
  units_sold_town: number;
  units_sold_players: number;
  units_wasted: number;
  town_demand: number;
  revenue: number;
  cost_of_goods: number;
  fixed_costs: number;
  other: number;
  profit: number | null;
  rating_delta: number;
  supply_extra: number;
  price: number | null;
  tips: { text: string }[] | null;
  units_left: number;
};

export async function getDay(db: Db, businessId: string, date: string): Promise<DaySummary | null> {
  const [d] = await db<DaySummary[]>`
    SELECT d.day_date::text AS day_date, d.opened_at IS NOT NULL AS opened, d.closed_at IS NOT NULL AS closed,
      d.units_prepared, d.units_credit, d.units_sold_town, d.units_sold_players, d.units_wasted, d.town_demand,
      d.revenue::float8 AS revenue, d.cost_of_goods::float8 AS cost_of_goods, d.fixed_costs::float8 AS fixed_costs,
      d.other::float8 AS other, d.profit::float8 AS profit, d.rating_delta::float8 AS rating_delta,
      d.supply_extra::float8 AS supply_extra, (d.plan->>'price')::int AS price, d.tips,
      coalesce(l.units_available, 0) AS units_left
    FROM hustle_days d LEFT JOIN hustle_listings l ON l.business_id = d.business_id AND l.day_date = d.day_date
    WHERE d.business_id = ${businessId} AND d.day_date = ${date}::date
  `;
  return d ?? null;
}

export async function getProfitSummary(businessId: string, today = lagosDate()) {
  const [r] = await sql<{ yesterday: number | null; week: number | null; receivable: number }[]>`
    SELECT
      (SELECT profit::float8 FROM hustle_days WHERE business_id = ${businessId} AND day_date = ${addDays(today, -1)}::date AND closed_at IS NOT NULL) AS yesterday,
      (SELECT sum(profit)::float8 FROM hustle_days WHERE business_id = ${businessId} AND day_date >= ${addDays(today, -7)}::date AND closed_at IS NOT NULL) AS week,
      (SELECT coalesce(sum(amount), 0)::float8 FROM hustle_receivables WHERE business_id = ${businessId} AND status = 'pending') AS receivable
  `;
  return r;
}

/** Businesses this one bought from or sold to in the last 14 days (filled in by player trades). */
export async function getPartners(businessId: string) {
  return sql<{ id: string; name: string; slug: string; icon: string; color: string; type_name: string; role: "Supplier" | "Customer"; n: number }[]>`
    SELECT b.id, b.name, b.slug, b.icon, b.color, t.name AS type_name, x.role, x.n
    FROM (
      SELECT seller_business_id AS id, 'Supplier' AS role, count(*)::int AS n FROM hustle_orders
      WHERE buyer_kind = 'business' AND buyer_id = ${businessId} AND status = 'done' AND created_at > now() - interval '14 days'
      GROUP BY seller_business_id
      UNION ALL
      SELECT buyer_id, 'Customer', count(*)::int FROM hustle_orders
      WHERE buyer_kind = 'business' AND seller_business_id = ${businessId} AND status = 'done' AND created_at > now() - interval '14 days'
      GROUP BY buyer_id
    ) x JOIN hustle_businesses b ON b.id = x.id JOIN hustle_business_types t ON t.slug = b.type_slug
    ORDER BY x.n DESC LIMIT 6
  `;
}
