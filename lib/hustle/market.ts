import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "../db";
import { lagosDate } from "../util";
import { addDays } from "./data";
import { scoreBand } from "./engine";
import { needFor, NEEDS } from "./needs";

/** Market filters: one per need, plus supplies and business services. */
export const MARKET_FILTERS = [
  { key: "all", label: "All" },
  ...NEEDS.map((n) => ({ key: n.key, label: n.label })),
  { key: "supplies", label: "Supplies" },
  { key: "services", label: "For businesses" },
] as const;

export type MarketRow = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  type_slug: string;
  type_name: string;
  unit_name: string;
  kind: "consumer" | "supplier" | "b2b";
  slots: boolean;
  perishable: boolean;
  need_key: string | null;
  owner_id: string;
  owner: string;
  rating: number;
  rating_count: number;
  stage: number;
  listing_id: number | null;
  left: number | null;
  prepared: number | null;
  price: number | null;
  default_price: number;
  score: number;
  days_played: number;
  served: number;
  state_businesses: number;
};

const gate = (r: { days_played: number; served: number; state_businesses: number }) => ({
  days: r.days_played,
  served: r.served,
  stateBusinesses: r.state_businesses,
});

/**
 * Business Score (0-1, shown only as a band): 0.4 × this week's profit (rank in the state) + 0.2 × rating
 * + 0.2 × growth on last week + 0.2 × cash health (in the black, nobody defaulted on them).
 */
const scoreSql = (state: string | null, today: string) => sql`
  WITH w AS (
    SELECT b.id, b.state, b.type_slug, b.rating::float8 AS rating, b.cash,
      coalesce(sum(d.profit) FILTER (WHERE d.day_date > ${addDays(today, -8)}::date), 0)::float8 AS p7,
      coalesce(sum(d.profit) FILTER (WHERE d.day_date <= ${addDays(today, -8)}::date), 0)::float8 AS prev7,
      EXISTS (SELECT 1 FROM hustle_receivables r WHERE r.business_id = b.id AND r.status = 'defaulted' AND r.due_on > ${addDays(today, -14)}::date) AS defaulted,
      -- Track record for the band rules (all time): days opened and customers served.
      (SELECT count(*) FROM hustle_days a WHERE a.business_id = b.id AND a.opened_at IS NOT NULL)::int AS days_played,
      (SELECT coalesce(sum(a.units_sold_town + a.units_sold_players), 0) FROM hustle_days a WHERE a.business_id = b.id)::int AS served
    FROM hustle_businesses b
    JOIN users u ON u.id = b.owner_user_id
    LEFT JOIN hustle_days d ON d.business_id = b.id AND d.closed_at IS NOT NULL AND d.day_date > ${addDays(today, -15)}::date
    WHERE b.status <> 'closed' AND NOT u.is_banned ${state ? sql`AND b.state = ${state}` : sql``}
    GROUP BY b.id
  )
  SELECT w.*, (count(*) OVER (PARTITION BY w.state))::int AS state_businesses, (
    -- No profit this week, no profit or growth points (so a brand-new business starts at Bronze).
    0.4 * CASE WHEN w.p7 > 0 THEN cume_dist() OVER (PARTITION BY w.state ORDER BY w.p7) ELSE 0 END
    + 0.2 * (w.rating - 1) / 4
    + 0.2 * CASE WHEN w.p7 = 0 AND w.prev7 = 0 THEN 0 ELSE (greatest(-1, least(1, (w.p7 - w.prev7) / greatest(1000, abs(w.prev7)))) + 1) / 2 END
    + 0.2 * CASE WHEN w.cash > 0 AND NOT w.defaulted THEN 1 WHEN w.cash > 0 THEN 0.5 ELSE 0 END
  ) AS score
  FROM w
`;

export async function getMarket(state: string, filter: string): Promise<MarketRow[]> {
  const today = lagosDate();
  const need = needFor(filter);
  const where =
    need ? sql`AND t.slug = ANY(${need.types as unknown as string[]})`
    : filter === "supplies" ? sql`AND (t.kind = 'supplier' OR t.sells_supply)`
    : filter === "services" ? sql`AND t.kind = 'b2b'`
    : sql``;
  return sql<MarketRow[]>`
    WITH s AS (${scoreSql(state, today)})
    SELECT b.id, b.name, b.slug, b.icon, b.color, t.slug AS type_slug, t.name AS type_name, t.unit_name, t.kind, t.slots, t.perishable,
      t.need_key, u.id AS owner_id, u.nickname AS owner, b.rating::float8 AS rating, b.rating_count, b.stage,
      l.id::int AS listing_id, l.units_available AS "left", d.units_prepared AS prepared, l.price, t.default_price,
      coalesce(s.score, 0)::float8 AS score, coalesce(s.days_played, 0) AS days_played, coalesce(s.served, 0) AS served,
      coalesce(s.state_businesses, 0) AS state_businesses
    FROM hustle_businesses b
    JOIN hustle_business_types t ON t.slug = b.type_slug
    JOIN users u ON u.id = b.owner_user_id
    LEFT JOIN s ON s.id = b.id
    LEFT JOIN hustle_listings l ON l.business_id = b.id AND l.day_date = ${today}::date
    LEFT JOIN hustle_days d ON d.business_id = b.id AND d.day_date = ${today}::date
    WHERE b.state = ${state} AND b.status <> 'closed' AND NOT b.trading_frozen AND NOT u.is_flagged AND NOT u.is_banned ${where}
    ORDER BY (coalesce(l.units_available, 0) > 0) DESC, s.score DESC NULLS LAST, b.name
    LIMIT 200
  `;
}

/** "3 of 10 slots left today", "Sold out today", "Closed today". */
export function availability(r: Pick<MarketRow, "left" | "prepared" | "slots" | "unit_name" | "kind" | "listing_id">) {
  if (r.listing_id === null || r.left === null) return { text: "Closed today", tone: "muted" as const };
  if (r.left <= 0) return { text: "Sold out today", tone: "muted" as const };
  const unit = r.kind === "supplier" ? "lot" : r.slots ? "slot" : r.unit_name;
  const text = r.prepared ? `${r.left} of ${r.prepared} ${unit}s left today` : `${r.left} ${unit}${r.left === 1 ? "" : "s"} left today`;
  return { text, tone: r.left <= 2 ? ("amber" as const) : ("lime" as const) };
}

export type Shop = MarketRow & { state: string; blurb: string; category: string; band: string; created_at: Date };

export async function getShop(slug: string): Promise<Shop | null> {
  const today = lagosDate();
  // The score ranks a business within its state, so only that state is scored.
  const [where] = await sql<{ state: string }[]>`SELECT state FROM hustle_businesses WHERE slug = ${slug}`;
  if (!where) return null;
  const [b] = await sql<Shop[]>`
    WITH s AS (${scoreSql(where.state, today)})
    SELECT b.id, b.name, b.slug, b.icon, b.color, b.state, b.created_at, t.slug AS type_slug, t.name AS type_name, t.blurb, t.category,
      t.unit_name, t.kind, t.slots, t.perishable, t.need_key, u.id AS owner_id, u.nickname AS owner, b.rating::float8 AS rating,
      b.rating_count, b.stage, l.id::int AS listing_id, l.units_available AS "left", d.units_prepared AS prepared, l.price,
      t.default_price, coalesce(s.score, 0)::float8 AS score, coalesce(s.days_played, 0) AS days_played,
      coalesce(s.served, 0) AS served, coalesce(s.state_businesses, 0) AS state_businesses
    FROM hustle_businesses b
    JOIN hustle_business_types t ON t.slug = b.type_slug
    JOIN users u ON u.id = b.owner_user_id
    LEFT JOIN s ON s.id = b.id
    LEFT JOIN hustle_listings l ON l.business_id = b.id AND l.day_date = ${today}::date
    LEFT JOIN hustle_days d ON d.business_id = b.id AND d.day_date = ${today}::date
    WHERE b.slug = ${slug} AND NOT u.is_banned
  `;
  return b ? { ...b, band: scoreBand(b.score, gate(b)) } : null;
}

export async function getReviews(businessId: string, limit = 20) {
  return sql<{ id: number; stars: number; text: string | null; created_at: Date; reviewer_id: string; nickname: string }[]>`
    SELECT r.id::int AS id, r.stars, r.text, r.created_at, u.id AS reviewer_id, u.nickname
    FROM hustle_reviews r JOIN users u ON u.id = r.reviewer_user_id
    WHERE r.business_id = ${businessId} AND NOT u.is_banned
    ORDER BY r.created_at DESC LIMIT ${limit}
  `;
}

/** Players who bought at least twice in the last 14 days. */
export async function getRegulars(businessId: string) {
  const [r] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM (
      SELECT buyer_user_id FROM hustle_orders WHERE seller_business_id = ${businessId} AND status = 'done' AND created_at > now() - interval '14 days'
      GROUP BY buyer_user_id HAVING count(*) >= 2
    ) x
  `;
  return r.n;
}

/** The viewer's orders from a shop that they haven't reviewed yet (newest first). */
export async function unreviewedOrders(userId: string, businessId: string) {
  return sql<{ id: number }[]>`
    SELECT o.id::int AS id FROM hustle_orders o
    WHERE o.buyer_user_id = ${userId} AND o.seller_business_id = ${businessId} AND o.status = 'done'
      AND NOT EXISTS (SELECT 1 FROM hustle_reviews r WHERE r.order_id = o.id)
    ORDER BY o.created_at DESC LIMIT 1
  `;
}

export type BoardRow = { id: string; name: string; slug: string; icon: string; color: string; type_name: string; owner: string; owner_id: string; rating: number; band: string; rank: number };

/** Top businesses in a state (optionally one type). Flagged owners and seed accounts are never ranked. */
export const getBoard = unstable_cache(
  async (state: string, type: string | null): Promise<BoardRow[]> => {
    const today = lagosDate();
    const rows = await sql<(Omit<BoardRow, "band" | "rank"> & { score: number; days_played: number; served: number; state_businesses: number })[]>`
      WITH s AS (${scoreSql(state, today)})
      SELECT b.id, b.name, b.slug, b.icon, b.color, t.name AS type_name, u.nickname AS owner, u.id AS owner_id,
        b.rating::float8 AS rating, s.score::float8 AS score, s.days_played, s.served, s.state_businesses
      FROM s JOIN hustle_businesses b ON b.id = s.id JOIN hustle_business_types t ON t.slug = b.type_slug JOIN users u ON u.id = b.owner_user_id
      WHERE NOT u.is_flagged AND NOT u.is_seed ${type ? sql`AND b.type_slug = ${type}` : sql``}
      ORDER BY s.score DESC, b.rating DESC, b.created_at LIMIT 50
    `;
    return rows.map(({ days_played, served, state_businesses, ...r }, i) => ({
      ...r,
      band: scoreBand(r.score, gate({ days_played, served, state_businesses })),
      rank: i + 1,
    }));
  },
  ["hustle-board"],
  { revalidate: 300, tags: ["hustle"] },
);

export type StateEconomy = { state: string; businesses: number; rank: number; trend: "up" | "down" | "same" };

/** States ranked by their businesses' total profit this week; trend against last week. No naira shown. */
export const getStateEconomy = unstable_cache(
  async (): Promise<StateEconomy[]> => {
    const today = lagosDate();
    const rows = await sql<{ state: string; businesses: number; p7: number; prev7: number }[]>`
      SELECT b.state, count(DISTINCT b.id)::int AS businesses,
        coalesce(sum(d.profit) FILTER (WHERE d.day_date > ${addDays(today, -8)}::date), 0)::float8 AS p7,
        coalesce(sum(d.profit) FILTER (WHERE d.day_date <= ${addDays(today, -8)}::date), 0)::float8 AS prev7
      FROM hustle_businesses b JOIN users u ON u.id = b.owner_user_id
      LEFT JOIN hustle_days d ON d.business_id = b.id AND d.closed_at IS NOT NULL AND d.day_date > ${addDays(today, -15)}::date
      WHERE b.status <> 'closed' AND NOT u.is_flagged AND NOT u.is_banned AND NOT u.is_seed
      GROUP BY b.state
    `;
    const rankBy = (key: "p7" | "prev7") => new Map([...rows].sort((a, b) => b[key] - a[key]).map((r, i) => [r.state, i + 1]));
    const now = rankBy("p7");
    const before = rankBy("prev7");
    return rows
      .map((r) => {
        const rank = now.get(r.state)!;
        const was = before.get(r.state)!;
        return { state: r.state, businesses: r.businesses, rank, trend: rank < was ? "up" : rank > was ? "down" : "same" } as StateEconomy;
      })
      .sort((a, b) => a.rank - b.rank);
  },
  ["hustle-states"],
  { revalidate: 300, tags: ["hustle"] },
);

export type PublicBusiness = Pick<Shop, "name" | "slug" | "icon" | "color" | "type_name" | "state" | "stage" | "rating" | "rating_count" | "band">;

/** The business card on profiles: name, type, state, stage, rating and score band. Never cash. */
export async function getPublicBusiness(ownerId: string): Promise<PublicBusiness | null> {
  const [b] = await sql<{ slug: string }[]>`SELECT slug FROM hustle_businesses WHERE owner_user_id = ${ownerId} AND status <> 'closed'`;
  if (!b) return null;
  const shop = await getShop(b.slug);
  if (!shop) return null;
  const { name, slug, icon, color, type_name, state, stage, rating, rating_count, band } = shop;
  return { name, slug, icon, color, type_name, state, stage, rating, rating_count, band };
}
