import "server-only";
import type postgres from "postgres";
import { sql } from "../db";
import type { Business, BusinessType, CardEffects, DecisionCard } from "./types";
import { seeded } from "./engine";
import { lagosDate } from "../util";

export type Db = postgres.Sql | postgres.ReservedSql;

export const typeColumns = (db: Db) => db`
  slug, name, blurb, category, tier, unit_name, kind, sells_supply, perishable, slots, open_air, expiry_days, default_price,
  cost_per_unit, capacity_per_day, rent_per_day, upkeep_per_day, upkeep_provider_type, marketing_per_day, supply_type,
  units_per_supply_lot, setup_cost, townspeople_demand_per_day, price_floor_pct::float8 AS price_floor_pct,
  price_ceiling_pct::float8 AS price_ceiling_pct, need_key, need_days, is_active, sort
`;

export const bizColumns = (db: Db, alias = "b") => db`
  ${db(alias)}.id, ${db(alias)}.owner_user_id, ${db(alias)}.type_slug, ${db(alias)}.name, ${db(alias)}.slug, ${db(alias)}.icon,
  ${db(alias)}.color, ${db(alias)}.state, ${db(alias)}.stage, ${db(alias)}.rating::float8 AS rating, ${db(alias)}.rating_count,
  ${db(alias)}.cash::float8 AS cash, ${db(alias)}.status, ${db(alias)}.hot_until::text AS hot_until,
  ${db(alias)}.closed_through::text AS closed_through, ${db(alias)}.restructures, ${db(alias)}.trading_frozen, ${db(alias)}.created_at
`;

export async function getTypes(db: Db = sql, activeOnly = false): Promise<BusinessType[]> {
  return db<BusinessType[]>`
    SELECT ${typeColumns(db)} FROM hustle_business_types ${activeOnly ? db`WHERE is_active` : db``} ORDER BY sort, name
  `;
}

export async function getType(db: Db, slug: string): Promise<BusinessType | null> {
  const [t] = await db<BusinessType[]>`SELECT ${typeColumns(db)} FROM hustle_business_types WHERE slug = ${slug}`;
  return t ?? null;
}

export async function getBusinessByOwner(db: Db, userId: string, forUpdate = false): Promise<Business | null> {
  const [b] = await db<Business[]>`
    SELECT ${bizColumns(db)} FROM hustle_businesses b WHERE b.owner_user_id = ${userId} ${forUpdate ? db`FOR UPDATE` : db``}
  `;
  return b ?? null;
}

export async function getBusinessById(db: Db, id: string, forUpdate = false): Promise<Business | null> {
  const [b] = await db<Business[]>`SELECT ${bizColumns(db)} FROM hustle_businesses b WHERE b.id = ${id} ${forUpdate ? db`FOR UPDATE` : db``}`;
  return b ?? null;
}

/** Adds `n` days to a YYYY-MM-DD date. */
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400_000);
}

/** The Lagos date a business was started on (its day 1). */
export const startDay = (b: Pick<Business, "created_at">) => lagosDate(b.created_at);

/** "Day 12": business days since it started, counting the first. */
export const dayNumber = (b: Pick<Business, "created_at">, date: string) => daysBetween(startDay(b), date) + 1;

export type MarketEvent = { id: number; headline: string; body: string; effects: { demand?: Record<string, number>; cost?: Record<string, number> } };

export async function activeEvents(db: Db, state: string, date: string): Promise<MarketEvent[]> {
  return db<MarketEvent[]>`
    SELECT id, headline, body, effects FROM hustle_events
    WHERE starts_on <= ${date}::date AND ends_on >= ${date}::date AND (state IS NULL OR state = ${state})
    ORDER BY starts_on DESC, id DESC
  `;
}

/** Product of the events' multipliers for this type (keyed by type slug, or by category). */
export function eventFactor(events: MarketEvent[], t: Pick<BusinessType, "slug" | "category">, kind: "demand" | "cost") {
  let f = 1;
  for (const e of events) {
    const m = e.effects?.[kind];
    if (!m) continue;
    const v = m[t.slug] ?? m[t.category] ?? m["*"];
    if (typeof v === "number" && v > 0) f *= v;
  }
  return f;
}

export type Modifiers = { demand: number; capacity: number; dailyCost: number; labels: string[] };

export async function activeModifiers(db: Db, businessId: string, date: string): Promise<Modifiers> {
  const rows = await db<{ kind: string; value: number; label: string }[]>`
    SELECT kind, value::float8 AS value, label FROM hustle_modifiers
    WHERE business_id = ${businessId} AND starts_on <= ${date}::date AND ends_on >= ${date}::date
  `;
  const m: Modifiers = { demand: 1, capacity: 1, dailyCost: 0, labels: [] };
  for (const r of rows) {
    if (r.kind === "demand") m.demand *= r.value;
    else if (r.kind === "capacity") m.capacity *= r.value;
    else m.dailyCost += r.value;
    m.labels.push(r.label);
  }
  return m;
}

/** Today's decision card for a business: a seeded pick among the active cards for its type. */
export async function cardFor(db: Db, b: Pick<Business, "id" | "type_slug">, date: string): Promise<DecisionCard | null> {
  const cards = await db<DecisionCard[]>`
    SELECT id::int AS id, slug, applies_to_types, prompt, options, is_active FROM hustle_decision_cards
    WHERE is_active AND (applies_to_types IS NULL OR ${b.type_slug} = ANY(applies_to_types))
    ORDER BY id
  `;
  if (!cards.length) return null;
  return cards[Math.floor(seeded(b.id, date, "card") * cards.length)];
}

/** Resolves "chance" effects with the day's seed, so the same choice always gives the same result. */
export function resolveEffects(e: CardEffects, businessId: string, date: string): CardEffects {
  if (!e.chance) return e;
  const roll = seeded(businessId, date, "card-chance");
  const { chance, ...rest } = e;
  return { ...rest, ...resolveEffects(roll < chance.p ? chance.then : chance.else, businessId, date) };
}

export type Rival = { id: string; price: number };

/**
 * Rivals: other businesses of the same type in the state that opened in the last 3 days, at today's price if
 * they've opened, else their latest price. Using recent openers (not only today's) means opening early or late
 * doesn't change how many customers you share the town with.
 */
export async function rivalsFor(db: Db, b: Pick<Business, "id" | "state" | "type_slug">, date: string): Promise<Rival[]> {
  return db<Rival[]>`
    SELECT DISTINCT ON (r.id) r.id, (d.plan->>'price')::int AS price
    FROM hustle_businesses r JOIN hustle_days d ON d.business_id = r.id
    WHERE r.state = ${b.state} AND r.type_slug = ${b.type_slug} AND r.id <> ${b.id} AND r.status <> 'closed'
      AND d.opened_at IS NOT NULL AND d.day_date BETWEEN ${addDays(date, -3)}::date AND ${date}::date
    ORDER BY r.id, d.day_date DESC
  `;
}
