import "server-only";
import { sql } from "./db";
import { PLACES_PER_REFERRAL } from "./config";

/**
 * Positions.
 *   score    = signup_number − PLACES_PER_REFERRAL × valid_referrals
 *   position = rank by score (lowest first), ties broken by earlier sign-up.
 *
 * A referral is valid when the referred user completed sign-up and neither
 * the referred user nor the referrer is flagged or banned.
 *
 * Seed accounts are left out entirely: they never hold a position or count as referrals.
 * Prize positions (prize_position, prize_signup) count verified users only.
 *
 * Use as a prefix: sql`${ranked()} SELECT ... FROM ranked ...`
 */
export const ranked = () => sql`
  WITH refs AS (
    SELECT r.referred_by AS id, count(*)::int AS c, max(r.completed_at) AS reached_at
    FROM users r
    WHERE r.referred_by IS NOT NULL AND r.completed_at IS NOT NULL
      AND NOT r.is_flagged AND NOT r.is_banned AND NOT r.is_seed
    GROUP BY r.referred_by
  ),
  base AS (
    SELECT u.id, u.signup_number, u.completed_at,
           CASE WHEN u.is_flagged THEN 0 ELSE COALESCE(refs.c, 0) END AS refs,
           refs.reached_at,
           (u.verification_status = 'verified' AND NOT u.is_flagged) AS verified
    FROM users u LEFT JOIN refs ON refs.id = u.id
    WHERE u.completed_at IS NOT NULL AND NOT u.is_banned AND NOT u.is_seed
  ),
  ranked AS (
    SELECT id, refs, reached_at, signup_number, verified,
           (signup_number - ${PLACES_PER_REFERRAL} * refs) AS score,
           (row_number() OVER (ORDER BY signup_number - ${PLACES_PER_REFERRAL} * refs, completed_at))::int AS position,
           (CASE WHEN verified THEN row_number() OVER (
              PARTITION BY verified ORDER BY signup_number - ${PLACES_PER_REFERRAL} * refs, completed_at) END)::int AS prize_position,
           (CASE WHEN verified THEN row_number() OVER (PARTITION BY verified ORDER BY signup_number) END)::int AS prize_signup
    FROM base
  )
`;

export type Rank = {
  position: number;
  refs: number;
  /** Place among verified users only (null when not verified). Used for the first-N prize. */
  prize_position: number | null;
  prize_signup: number | null;
};

export async function getRank(userId: string): Promise<Rank | null> {
  const rows = await sql<Rank[]>`
    ${ranked()} SELECT position, refs, prize_position, prize_signup FROM ranked WHERE id = ${userId}
  `;
  return rows[0] ?? null;
}

export type ReferrerRow = {
  id: string;
  nickname: string;
  state: string | null;
  photo_version: number;
  refs: number;
  rank: number;
  /** Place among verified referrers only (null when not verified). Used for the top-referrer prize. */
  prize_rank: number | null;
};

/** Referrers ranked by valid referrals; ties go to whoever reached the count first. */
const referrerRanks = () => sql`
  ${ranked()},
  ref_ranked AS (
    SELECT r.id, u.nickname, u.state, u.photo_version, r.refs,
           (row_number() OVER (ORDER BY r.refs DESC, r.reached_at ASC))::int AS rank,
           (CASE WHEN r.verified THEN row_number() OVER (PARTITION BY r.verified ORDER BY r.refs DESC, r.reached_at ASC) END)::int AS prize_rank
    FROM ranked r JOIN users u ON u.id = r.id
    WHERE r.refs > 0
  )
`;

export async function getTopReferrers(limit: number): Promise<ReferrerRow[]> {
  return sql<ReferrerRow[]>`${referrerRanks()} SELECT * FROM ref_ranked WHERE rank <= ${limit} ORDER BY rank`;
}

export async function getReferrerRank(userId: string): Promise<ReferrerRow | null> {
  const rows = await sql<ReferrerRow[]>`${referrerRanks()} SELECT * FROM ref_ranked WHERE id = ${userId}`;
  return rows[0] ?? null;
}

/** Latest position snapshot on or before today (Lagos). */
export async function getSnapshotPosition(userId: string, today: string): Promise<number | null> {
  const rows = await sql<{ position: number }[]>`
    SELECT position FROM position_snapshots
    WHERE user_id = ${userId} AND snapshot_date <= ${today}::date
    ORDER BY snapshot_date DESC LIMIT 1
  `;
  return rows[0]?.position ?? null;
}

export type MemberRow = {
  id: string;
  nickname: string;
  photo_version: number;
  /** Null for seed accounts: they're listed but never hold a position. */
  position: number | null;
};

/** Everyone listed in a state: ranked users by position first, then seed accounts by join time. */
export async function getStateMembers(state: string, limit: number): Promise<MemberRow[]> {
  return sql<MemberRow[]>`
    ${ranked()}
    SELECT u.id, u.nickname, u.photo_version, r.position
    FROM users u LEFT JOIN ranked r ON r.id = u.id
    WHERE u.state = ${state} AND u.show_in_list AND u.completed_at IS NOT NULL AND NOT u.is_banned
      AND (r.id IS NOT NULL OR u.is_seed)
    ORDER BY r.position NULLS LAST, u.completed_at DESC
    LIMIT ${limit}
  `;
}

/** Next goal shown on Home, e.g. "Invite 2 more to reach the top 300". */
export function nextGoal(position: number) {
  if (position <= 10) return null;
  let target: number;
  let from: number;
  if (position > 100) {
    target = Math.floor((position - 1) / 100) * 100;
    from = target + 100;
  } else if (position > 50) {
    target = 50;
    from = 100;
  } else {
    target = 10;
    from = 50;
  }
  const invites = Math.max(1, Math.ceil((position - target) / PLACES_PER_REFERRAL));
  const progress = Math.min(1, Math.max(0, (from - position) / (from - target)));
  return { target, invites, progress };
}
