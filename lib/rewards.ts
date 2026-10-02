import "server-only";
import { sql } from "./db";
import { ranked } from "./ranking";

/**
 * Reward money: settings, the budget tracker and who a bulk award goes to.
 * Payout details (payout_* columns) are never read here: only the owner's Rewards page and the admin read them.
 */

export const DEFAULT_BUDGET_NGN = 200_000;
export const DEFAULT_PRESETS: Record<string, number[]> = {
  top_referrers: [30000, 20000, 15000, 10000, 10000, 5000, 5000, 5000, 5000, 5000],
};

export type MoneySettings = {
  budget: number;
  /** Most one user may be awarded in total (non-rejected rewards); null means no cap. */
  cap: number | null;
  presets: Record<string, number[]>;
};

function parsePresets(raw: string | undefined): Record<string, number[]> {
  try {
    const v = JSON.parse(raw || "null");
    if (!v || typeof v !== "object") return DEFAULT_PRESETS;
    const out: Record<string, number[]> = {};
    for (const [k, list] of Object.entries(v)) {
      if (Array.isArray(list)) out[k] = list.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    }
    return { ...DEFAULT_PRESETS, ...out };
  } catch {
    return DEFAULT_PRESETS;
  }
}

/** Read fresh on every admin page (not cached) so the numbers are always current. */
export async function getMoneySettings(): Promise<MoneySettings> {
  const rows = await sql<{ key: string; value: string }[]>`
    SELECT key, value FROM settings WHERE key IN ('rewards_budget_ngn', 'max_claim_per_user_ngn', 'prize_presets')
  `;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const budget = Number(map.get("rewards_budget_ngn"));
  const cap = Number(map.get("max_claim_per_user_ngn"));
  return {
    budget: Number.isFinite(budget) && budget >= 0 && map.get("rewards_budget_ngn") !== "" ? budget : DEFAULT_BUDGET_NGN,
    cap: map.get("max_claim_per_user_ngn") && Number.isFinite(cap) && cap > 0 ? cap : null,
    presets: parsePresets(map.get("prize_presets")),
  };
}

export type Budget = {
  budget: number;
  /** Sum of amounts on every reward that isn't rejected, hidden ones included. */
  awarded: number;
  claimed: number;
  processing: number;
  paid: number;
  remaining: number;
  /** Hidden or unclaimed rewards with no amount yet. */
  noAmount: number;
  /** Paid before amounts existed (migrated from the old 'sent' status). */
  legacyPaid: number;
};

export async function getBudget(settings?: MoneySettings): Promise<Budget> {
  const [s, [row]] = await Promise.all([
    settings ?? getMoneySettings(),
    sql<Omit<Budget, "budget" | "remaining">[]>`
      SELECT COALESCE(sum(amount_ngn) FILTER (WHERE status <> 'rejected'), 0)::int AS awarded,
             COALESCE(sum(amount_ngn) FILTER (WHERE status = 'claimed'), 0)::int AS claimed,
             COALESCE(sum(amount_ngn) FILTER (WHERE status = 'processing'), 0)::int AS processing,
             COALESCE(sum(amount_ngn) FILTER (WHERE status = 'paid'), 0)::int AS paid,
             count(*) FILTER (WHERE amount_ngn IS NULL AND status IN ('hidden', 'unclaimed'))::int AS "noAmount",
             count(*) FILTER (WHERE amount_ngn IS NULL AND status = 'paid')::int AS "legacyPaid"
      FROM rewards
    `,
  ]);
  return { ...row, budget: s.budget, remaining: s.budget - row.awarded };
}

/** Each user's awarded total (non-rejected rewards), for the per-user cap warning. */
export async function getUserTotals(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await sql<{ user_id: string; total: number }[]>`
    SELECT user_id, COALESCE(sum(amount_ngn), 0)::int AS total FROM rewards
    WHERE user_id IN ${sql(userIds)} AND status <> 'rejected'
    GROUP BY user_id
  `;
  return new Map(rows.map((r) => [r.user_id, r.total]));
}

export type Candidate = {
  id: string;
  nickname: string;
  state: string | null;
  verified: boolean;
  /** Overall referrer rank (top referrer awards only). */
  board_rank?: number;
  refs?: number;
};

export type Recipients = {
  list: Candidate[];
  skipped: { flaggedOrBanned: number; unverified: number; seed: number };
};

/**
 * Top N referrers, nationwide or in one state, in leaderboard order (ties go to whoever got there first).
 * Flagged, banned and seed accounts are never on the board. With verifiedOnly, unverified referrers are
 * passed over and the next verified one moves up.
 */
export async function getTopReferrerRecipients(n: number, state: string | null, verifiedOnly: boolean): Promise<Recipients> {
  const rows = await sql<(Candidate & { board_rank: number })[]>`
    ${ranked()}
    SELECT u.id, u.nickname, u.state, r.verified, r.refs,
           (row_number() OVER (ORDER BY r.refs DESC, r.reached_at ASC))::int AS board_rank
    FROM ranked r JOIN users u ON u.id = r.id
    WHERE r.refs > 0 AND ${state ? sql`u.state = ${state}` : sql`true`}
    ORDER BY board_rank
    LIMIT ${Math.min(2000, n * 50)}
  `;
  const list: Candidate[] = [];
  let unverified = 0;
  for (const r of rows) {
    if (list.length >= n) break;
    if (verifiedOnly && !r.verified) {
      unverified++;
      continue;
    }
    list.push(r);
  }
  // Flagged users have no valid referrals, so they're off the board already; say how many sit near the top.
  const [flagged] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM users u
    WHERE (u.is_flagged OR u.is_banned) AND NOT u.is_seed AND u.completed_at IS NOT NULL
      AND ${state ? sql`u.state = ${state}` : sql`true`}
      AND EXISTS (SELECT 1 FROM users f WHERE f.referred_by = u.id AND f.completed_at IS NOT NULL)
  `;
  return { list, skipped: { flaggedOrBanned: flagged.n, unverified, seed: 0 } };
}

/** Everyone holding the Early Corper badge (not revoked), minus flagged, banned and seed accounts. */
export async function getEarlyCorperRecipients(verifiedOnly: boolean): Promise<Recipients> {
  const rows = await sql<(Candidate & { is_flagged: boolean; is_banned: boolean; is_seed: boolean })[]>`
    SELECT u.id, u.nickname, u.state, (u.verification_status = 'verified') AS verified, u.is_flagged, u.is_banned, u.is_seed
    FROM user_badges ub JOIN users u ON u.id = ub.user_id
    WHERE ub.badge_slug = 'early_corper' AND ub.revoked_at IS NULL AND u.completed_at IS NOT NULL
    ORDER BY u.signup_number
  `;
  return partition(rows, verifiedOnly);
}

/** Users the admin ticked in the users table, minus flagged, banned and seed accounts. */
export async function getSelectedRecipients(ids: string[]): Promise<Recipients> {
  if (ids.length === 0) return { list: [], skipped: { flaggedOrBanned: 0, unverified: 0, seed: 0 } };
  const rows = await sql<(Candidate & { is_flagged: boolean; is_banned: boolean; is_seed: boolean })[]>`
    SELECT u.id, u.nickname, u.state, (u.verification_status = 'verified') AS verified, u.is_flagged, u.is_banned, u.is_seed
    FROM users u WHERE u.id IN ${sql(ids)} AND u.completed_at IS NOT NULL
    ORDER BY u.nickname
  `;
  return partition(rows, false);
}

function partition(rows: (Candidate & { is_flagged: boolean; is_banned: boolean; is_seed: boolean })[], verifiedOnly: boolean): Recipients {
  const skipped = { flaggedOrBanned: 0, unverified: 0, seed: 0 };
  const list: Candidate[] = [];
  for (const r of rows) {
    if (r.is_flagged || r.is_banned) skipped.flaggedOrBanned++;
    else if (r.is_seed) skipped.seed++;
    else if (verifiedOnly && !r.verified) skipped.unverified++;
    else list.push({ id: r.id, nickname: r.nickname, state: r.state, verified: r.verified });
  }
  return { list, skipped };
}
