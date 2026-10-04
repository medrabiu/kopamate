import "server-only";
import { sql } from "../db";
import { lagosDate } from "../util";
import { addDays } from "./data";

/** Reasons money enters the game, and leaves it. Everything else moves between players. */
const IN = ["grant", "allawee", "task", "prize", "townspeople", "spoilage_salvage", "credit_repaid", "restructure"];

/** Every pot's state: a wallet's owner's state, or a business's state. Used to filter the dashboard. */
const potStates = sql`
  SELECT 'wallet' AS kind, w.user_id AS id, u.state FROM hustle_wallets w JOIN users u ON u.id = w.user_id
  UNION ALL SELECT 'business', b.id, b.state FROM hustle_businesses b
`;

export async function economy(state: string | null) {
  const since = addDays(lagosDate(), -13);
  const inState = (kind: string, id: string) =>
    state ? sql`EXISTS (SELECT 1 FROM (${potStates}) p WHERE p.kind = ${sql(kind)} AND p.id = ${sql(id)} AND p.state = ${state})` : sql`true`;
  const [days, totals, byType, red] = await Promise.all([
    sql<{ day: string; money_in: number; money_out: number; between: number }[]>`
      SELECT to_char(l.at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD') AS day,
        coalesce(sum(l.amount) FILTER (WHERE l.from_kind = 'system'), 0)::float8 AS money_in,
        coalesce(sum(l.amount) FILTER (WHERE l.to_kind = 'system'), 0)::float8 AS money_out,
        coalesce(sum(l.amount) FILTER (WHERE l.from_kind <> 'system' AND l.to_kind <> 'system'), 0)::float8 AS between
      FROM hustle_ledger l
      WHERE l.at >= ${new Date(`${since}T00:00:00+01:00`)}
        AND (${inState("l.from_kind", "l.from_id")} OR ${inState("l.to_kind", "l.to_id")})
      GROUP BY 1 ORDER BY 1 DESC
    `,
    sql<{ wallets: number; cash: number; businesses: number; players: number }[]>`
      SELECT
        (SELECT coalesce(sum(w.balance), 0) FROM hustle_wallets w JOIN users u ON u.id = w.user_id ${state ? sql`WHERE u.state = ${state}` : sql``})::float8 AS wallets,
        (SELECT coalesce(sum(cash), 0) FROM hustle_businesses ${state ? sql`WHERE state = ${state}` : sql``})::float8 AS cash,
        (SELECT count(*) FROM hustle_businesses ${state ? sql`WHERE state = ${state}` : sql``})::int AS businesses,
        (SELECT count(*) FROM hustle_wallets w JOIN users u ON u.id = w.user_id ${state ? sql`WHERE u.state = ${state}` : sql``})::int AS players
    `,
    sql<{ type: string; state: string; n: number }[]>`
      SELECT t.name AS type, b.state, count(*)::int AS n FROM hustle_businesses b JOIN hustle_business_types t ON t.slug = b.type_slug
      ${state ? sql`WHERE b.state = ${state}` : sql``}
      GROUP BY t.name, b.state ORDER BY n DESC, t.name LIMIT 60
    `,
    sql<{ red: number; total: number }[]>`
      SELECT count(*) FILTER (WHERE cash < 0)::int AS red, count(*)::int AS total FROM hustle_businesses
      WHERE status <> 'closed' ${state ? sql`AND state = ${state}` : sql``}
    `,
  ]);
  const byReason = await sql<{ reason: string; dir: "in" | "out"; total: number }[]>`
    SELECT reason, CASE WHEN from_kind = 'system' THEN 'in' ELSE 'out' END AS dir, sum(amount)::float8 AS total
    FROM hustle_ledger l
    WHERE (from_kind = 'system' OR to_kind = 'system') AND at >= ${new Date(`${since}T00:00:00+01:00`)}
      AND (${inState("l.from_kind", "l.from_id")} OR ${inState("l.to_kind", "l.to_id")})
    GROUP BY 1, 2 ORDER BY 3 DESC
  `;
  return { days, totals: totals[0], byType, red: red[0], byReason, inReasons: IN };
}

/** Pairs that trade a lot, sellers living off one buyer, sudden cash jumps, and repeat restructures. */
export async function abuseSignals() {
  const [pairs, share, jumps, restructures] = await Promise.all([
    sql<{ buyer: string; buyer_id: string; seller: string; seller_id: string; n: number; total: number }[]>`
      SELECT u.nickname AS buyer, u.id AS buyer_id, b.name AS seller, b.id AS seller_id, count(*)::int AS n, sum(o.total)::float8 AS total
      FROM hustle_orders o JOIN users u ON u.id = o.buyer_user_id JOIN hustle_businesses b ON b.id = o.seller_business_id
      WHERE o.status = 'done' AND o.created_at > now() - interval '7 days'
      GROUP BY u.nickname, u.id, b.name, b.id HAVING count(*) > 15 ORDER BY n DESC LIMIT 50
    `,
    sql<{ buyer: string; seller: string; seller_id: string; pct: number; total: number }[]>`
      WITH r AS (
        SELECT seller_business_id, buyer_user_id, sum(total) AS t FROM hustle_orders
        WHERE status = 'done' AND created_at > now() - interval '7 days' GROUP BY 1, 2
      ), s AS (SELECT seller_business_id, sum(t) AS all_t FROM r GROUP BY 1)
      SELECT u.nickname AS buyer, b.name AS seller, b.id AS seller_id, round(100 * r.t / s.all_t)::int AS pct, s.all_t::float8 AS total
      FROM r JOIN s USING (seller_business_id) JOIN users u ON u.id = r.buyer_user_id JOIN hustle_businesses b ON b.id = r.seller_business_id
      WHERE s.all_t >= 3000 AND r.t > 0.6 * s.all_t ORDER BY s.all_t DESC LIMIT 50
    `,
    sql<{ id: string; name: string; owner: string; gained: number; frozen: boolean }[]>`
      SELECT b.id, b.name, u.nickname AS owner, sum(l.amount)::float8 AS gained, b.trading_frozen AS frozen
      FROM hustle_ledger l JOIN hustle_businesses b ON b.id = l.to_id JOIN users u ON u.id = b.owner_user_id
      WHERE l.to_kind = 'business' AND l.at > now() - interval '24 hours'
        AND l.reason IN ('purchase_need', 'purchase_supply', 'invest', 'prize', 'upkeep', 'marketing')
      GROUP BY b.id, b.name, u.nickname HAVING sum(l.amount) > 20000 ORDER BY gained DESC LIMIT 50
    `,
    sql<{ id: string; name: string; owner: string; restructures: number; cash: number; frozen: boolean }[]>`
      SELECT b.id, b.name, u.nickname AS owner, b.restructures, b.cash::float8 AS cash, b.trading_frozen AS frozen
      FROM hustle_businesses b JOIN users u ON u.id = b.owner_user_id
      WHERE b.restructures > 0 OR b.trading_frozen ORDER BY b.restructures DESC, b.name LIMIT 50
    `,
  ]);
  return { pairs, share, jumps, restructures };
}

/** Recent ledger entries for one player (by username), to find an entry to reverse. */
export async function ledgerFor(username: string) {
  const [u] = await sql<{ id: string }[]>`SELECT id FROM users WHERE lower(nickname) = lower(${username})`;
  if (!u) return null;
  const [b] = await sql<{ id: string; name: string; frozen: boolean }[]>`SELECT id, name, trading_frozen AS frozen FROM hustle_businesses WHERE owner_user_id = ${u.id}`;
  const ids = [u.id, ...(b ? [b.id] : [])];
  const rows = await sql<{ id: number; at: Date; from_kind: string; to_kind: string; amount: number; reason: string; note: string | null; incoming: boolean }[]>`
    SELECT id::int AS id, at, from_kind, to_kind, amount::float8 AS amount, reason, note, (to_id = ANY(${ids}::uuid[])) AS incoming
    FROM hustle_ledger WHERE from_id = ANY(${ids}::uuid[]) OR to_id = ANY(${ids}::uuid[])
    ORDER BY id DESC LIMIT 60
  `;
  return { business: b ?? null, rows };
}
