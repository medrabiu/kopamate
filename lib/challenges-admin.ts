import "server-only";
import { sql } from "./db";
import { countedSql } from "./challenge-signups";
import type { EntryStatus } from "./challenges";
import type { Platform } from "./challenge-rules";

/** Admin-only reads for a challenge. Never phone numbers or emails: nickname, state and handles only. */

export type AdminEntry = {
  id: number;
  user_id: string;
  nickname: string;
  state: string | null;
  platform: Platform;
  post_url: string;
  format: string;
  caption_note: string | null;
  entry_code: string;
  submitted_at: Date;
  status: EntryStatus;
  reject_reason: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  has_shot: boolean;
  metrics_submitted_at: Date | null;
  metrics_verified: boolean;
  handle: string | null;
  follow_check_status: "unchecked" | "ok" | "failed";
  joined: number;
  verified: number;
  counted: number;
  voided: number;
};

export const ENTRY_SORTS = {
  newest: sql`e.submitted_at DESC`,
  oldest: sql`e.submitted_at`,
  counted: sql`counted DESC, joined DESC, e.submitted_at`,
  joined: sql`joined DESC, e.submitted_at`,
  views: sql`e.views DESC NULLS LAST, e.submitted_at`,
} as const;
export type EntrySort = keyof typeof ENTRY_SORTS;

/** Sign-up counts for a group of challenge_signups rows `s` (needs `c` for the counted rule). */
const signupCounts = sql`
  count(s.id)::int AS joined,
  count(s.id) FILTER (WHERE s.void_reason IS NULL AND nu.verification_status = 'verified')::int AS verified,
  count(s.id) FILTER (WHERE ${countedSql(sql)})::int AS counted,
  count(s.id) FILTER (WHERE s.void_reason IS NOT NULL)::int AS voided
`;

export async function getAdminEntries(challengeId: number, status: EntryStatus | "all", sort: EntrySort): Promise<AdminEntry[]> {
  return sql<AdminEntry[]>`
    SELECT e.id, e.user_id, u.nickname, u.state, e.platform, e.post_url, e.format, e.caption_note, e.entry_code, e.submitted_at,
           e.status, e.reject_reason, e.views, e.likes, e.comments, e.shares, e.metrics_screenshot IS NOT NULL AS has_shot,
           e.metrics_submitted_at, e.metrics_verified,
           CASE e.platform WHEN 'x' THEN p.x_handle WHEN 'tiktok' THEN p.tiktok_handle ELSE p.instagram_handle END AS handle,
           p.follow_check_status,
           ${signupCounts}
    FROM challenge_entries e
    JOIN challenges c ON c.id = e.challenge_id
    JOIN users u ON u.id = e.user_id
    LEFT JOIN challenge_participants p ON p.challenge_id = e.challenge_id AND p.user_id = e.user_id
    LEFT JOIN challenge_signups s ON s.entry_id = e.id
    LEFT JOIN users nu ON nu.id = s.new_user_id
    WHERE e.challenge_id = ${challengeId} AND (${status} = 'all' OR e.status = ${status})
    GROUP BY e.id, u.id, p.challenge_id, p.user_id, c.id
    ORDER BY ${ENTRY_SORTS[sort]}
    LIMIT 500
  `;
}

export type Entrant = {
  user_id: string;
  nickname: string;
  state: string | null;
  x_handle: string | null;
  tiktok_handle: string | null;
  instagram_handle: string | null;
  confirmed_follow_x: boolean;
  confirmed_follow_other: boolean;
  confirmed_whatsapp_channel: boolean;
  check_x: boolean | null;
  check_other: boolean | null;
  check_whatsapp: boolean | null;
  follow_check_status: "unchecked" | "ok" | "failed";
  entries: number;
  approved: number;
  views: number;
  joined: number;
  verified: number;
  counted: number;
  voided: number;
};

/** Everyone who joined, with their entries and every sign-up they brought (entry links and their invite link). */
export async function getEntrants(challengeId: number): Promise<Entrant[]> {
  return sql<Entrant[]>`
    SELECT p.user_id, u.nickname, u.state, p.x_handle, p.tiktok_handle, p.instagram_handle,
           p.confirmed_follow_x, p.confirmed_follow_other, p.confirmed_whatsapp_channel,
           p.check_x, p.check_other, p.check_whatsapp, p.follow_check_status,
           (SELECT count(*) FROM challenge_entries e WHERE e.challenge_id = p.challenge_id AND e.user_id = p.user_id)::int AS entries,
           (SELECT count(*) FROM challenge_entries e WHERE e.challenge_id = p.challenge_id AND e.user_id = p.user_id AND e.status = 'approved')::int AS approved,
           (SELECT COALESCE(sum(e.views), 0) FROM challenge_entries e
            WHERE e.challenge_id = p.challenge_id AND e.user_id = p.user_id AND e.status = 'approved')::int AS views,
           ${signupCounts}
    FROM challenge_participants p
    JOIN challenges c ON c.id = p.challenge_id
    JOIN users u ON u.id = p.user_id
    LEFT JOIN challenge_signups s ON s.challenge_id = p.challenge_id AND s.referrer_user_id = p.user_id
    LEFT JOIN users nu ON nu.id = s.new_user_id
    WHERE p.challenge_id = ${challengeId}
    GROUP BY p.challenge_id, p.user_id, u.id, c.id
    ORDER BY counted DESC, approved DESC, views DESC, u.nickname
  `;
}

export type AdminSignup = {
  id: number;
  referrer_id: string;
  referrer: string;
  entry_id: number | null;
  new_user_id: string;
  nickname: string;
  state: string | null;
  signed_up_at: Date;
  verification_status: string;
  counted: boolean;
  void_reason: string | null;
  flags: string[];
};

/**
 * Sign-ups with fraud flags: same network as the person who brought them, 3+ from one network for the same
 * person, 5+ for the same person within an hour, between 1am and 5am Lagos time, or never back after day 1.
 */
export async function getAdminSignups(challengeId: number, referrerId: string | null): Promise<AdminSignup[]> {
  return sql<AdminSignup[]>`
    WITH rows AS (
      SELECT s.id, s.referrer_user_id AS referrer_id, ru.nickname AS referrer, s.entry_id, s.new_user_id, nu.nickname, nu.state,
             s.signed_up_at, nu.verification_status, ${countedSql(sql)} AS counted, s.void_reason,
             nu.signup_ip_hash IS NOT NULL AND nu.signup_ip_hash = ru.signup_ip_hash AS same_ip,
             nu.signup_ip_hash IS NOT NULL AND count(*) OVER (PARTITION BY s.referrer_user_id, nu.signup_ip_hash) >= 3 AS shared_ip,
             (SELECT count(*) FROM challenge_signups b
              WHERE b.challenge_id = s.challenge_id AND b.referrer_user_id = s.referrer_user_id
                AND b.signed_up_at BETWEEN s.signed_up_at - interval '30 minutes' AND s.signed_up_at + interval '30 minutes') >= 5 AS burst,
             extract(hour FROM s.signed_up_at AT TIME ZONE 'Africa/Lagos') BETWEEN 1 AND 4 AS odd_hour,
             s.signed_up_at < now() - interval '2 days'
               AND (nu.last_seen_on IS NULL OR nu.last_seen_on <= (s.signed_up_at AT TIME ZONE 'Africa/Lagos')::date + 1) AS never_back
      FROM challenge_signups s
      JOIN challenges c ON c.id = s.challenge_id
      JOIN users nu ON nu.id = s.new_user_id
      JOIN users ru ON ru.id = s.referrer_user_id
      WHERE s.challenge_id = ${challengeId}
    )
    SELECT id, referrer_id, referrer, entry_id, new_user_id, nickname, state, signed_up_at, verification_status, counted, void_reason,
           array_remove(ARRAY[
             CASE WHEN same_ip THEN 'Same network as the person who brought them' END,
             CASE WHEN shared_ip THEN '3+ from one network' END,
             CASE WHEN burst THEN '5+ within an hour' END,
             CASE WHEN odd_hour THEN '1am–5am' END,
             CASE WHEN never_back THEN 'Never came back' END
           ], NULL) AS flags
    FROM rows
    WHERE ${referrerId}::uuid IS NULL OR referrer_id = ${referrerId}::uuid
    ORDER BY cardinality(array_remove(ARRAY[same_ip, shared_ip, burst, odd_hour, never_back], false)) DESC, signed_up_at DESC
    LIMIT 1000
  `;
}

/** Headline numbers for the challenge's admin page. */
export async function getChallengeStats(challengeId: number) {
  const [row] = await sql<
    { participants: number; entries: number; approved: number; pending: number; views: number; joined: number; verified: number; counted: number }[]
  >`
    SELECT (SELECT count(*) FROM challenge_participants WHERE challenge_id = c.id)::int AS participants,
           (SELECT count(*) FROM challenge_entries WHERE challenge_id = c.id)::int AS entries,
           (SELECT count(*) FROM challenge_entries WHERE challenge_id = c.id AND status = 'approved')::int AS approved,
           (SELECT count(*) FROM challenge_entries WHERE challenge_id = c.id AND status = 'pending')::int AS pending,
           (SELECT COALESCE(sum(views), 0) FROM challenge_entries WHERE challenge_id = c.id AND status = 'approved')::int AS views,
           (SELECT count(*) FROM challenge_signups s WHERE s.challenge_id = c.id)::int AS joined,
           (SELECT count(*) FROM challenge_signups s JOIN users nu ON nu.id = s.new_user_id
            WHERE s.challenge_id = c.id AND s.void_reason IS NULL AND nu.verification_status = 'verified')::int AS verified,
           (SELECT count(*) FROM challenge_signups s JOIN users nu ON nu.id = s.new_user_id
            WHERE s.challenge_id = c.id AND ${countedSql(sql)})::int AS counted
    FROM challenges c WHERE c.id = ${challengeId}
  `;
  const breakdown = await sql<{ kind: string; key: string; n: number }[]>`
    SELECT 'platform' AS kind, platform AS key, count(*)::int AS n FROM challenge_entries WHERE challenge_id = ${challengeId} GROUP BY platform
    UNION ALL
    SELECT 'format', format, count(*)::int FROM challenge_entries WHERE challenge_id = ${challengeId} GROUP BY format
    UNION ALL
    SELECT 'state', COALESCE(u.state, '–'), count(*)::int FROM challenge_participants p JOIN users u ON u.id = p.user_id
    WHERE p.challenge_id = ${challengeId} GROUP BY u.state
    ORDER BY n DESC
  `;
  return { ...row, breakdown };
}
