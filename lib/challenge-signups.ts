import type { Sql } from "postgres";

/**
 * Challenge sign-up attribution. No server-only imports and the connection is passed in, so the
 * same code runs in the app and in scripts/test-challenge-signups.mjs against a local database.
 */

/**
 * Whether a challenge_signups row counts, as SQL. Needs the aliases `s` (challenge_signups), `nu` (the new
 * user) and `c` (challenges). It counts when it isn't voided and the new user got verified by the
 * challenge's verify_by (or 14 days after it closes), and isn't flagged, banned or a seed account.
 */
export function countedSql(sql: Sql) {
  return sql`(
    s.void_reason IS NULL AND nu.verification_status = 'verified' AND nu.verified_at IS NOT NULL
    AND nu.verified_at <= COALESCE(c.verify_by, c.closes_at + interval '14 days')
    AND NOT nu.is_flagged AND NOT nu.is_banned AND NOT nu.is_seed AND nu.id <> s.referrer_user_id
  )`;
}

/**
 * Called once a new user finishes sign-up with a referrer. Records the sign-up for every open challenge
 * the referrer has joined, inside the challenge's window. The entry comes from the entry link they used
 * (km_entry) when it's the referrer's own entry in that challenge; otherwise it's credited to the person.
 * Returns how many challenges it was recorded for.
 */
export async function recordChallengeSignup(
  sql: Sql,
  { newUserId, referrerId, entryCode }: { newUserId: string; referrerId: string; entryCode: string | null },
) {
  if (newUserId === referrerId) return 0;
  const rows = await sql`
    INSERT INTO challenge_signups (challenge_id, entry_id, referrer_user_id, new_user_id)
    SELECT c.id,
           (SELECT e.id FROM challenge_entries e
            WHERE e.entry_code = ${entryCode} AND e.challenge_id = c.id AND e.user_id = ${referrerId}),
           ${referrerId}, ${newUserId}
    FROM challenges c
    JOIN challenge_participants p ON p.challenge_id = c.id AND p.user_id = ${referrerId}
    WHERE c.status = 'open' AND c.opens_at <= now() AND c.closes_at > now()
    ON CONFLICT (challenge_id, new_user_id) DO NOTHING
    RETURNING id
  `;
  return rows.length;
}

/** The owner of an entry link, if the entry exists and its owner is a real, active, completed user. */
export async function entryOwner(sql: Sql, entryCode: string) {
  const clean = entryCode.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!clean) return null;
  const rows = await sql<{ id: string; nickname: string; photo_version: number; referral_code: string }[]>`
    SELECT u.id, u.nickname, u.photo_version, u.referral_code
    FROM challenge_entries e JOIN users u ON u.id = e.user_id
    WHERE e.entry_code = ${clean} AND u.completed_at IS NOT NULL AND NOT u.is_banned
  `;
  return rows[0] ?? null;
}
