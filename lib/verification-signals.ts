import "server-only";
import { sql } from "./db";
import { stateCodeProblem } from "./states";

/**
 * Warnings for an admin reviewing someone's verification: signs the same person is behind several
 * accounts, or that the state code is made up. Nothing here blocks on its own; the admin decides.
 */
export type Signals = {
  /** Other accounts whose ID card photo is the same file, or looks the same (difference hash within 6 bits). */
  photoMatches: { id: string; nickname: string; status: string; exact: boolean }[];
  /** Other accounts with the same full name in the same state. */
  sameName: { id: string; nickname: string; status: string }[];
  /** Other accounts that signed up from the same network (hashed IP). */
  network: { total: number; verified: number; pending: number };
  /** Accounts on that network this person invited or was invited by (possible referral farming). */
  networkReferrals: { id: string; nickname: string }[];
  /** The code doesn't match their state or isn't a current batch. */
  codeProblem: string | null;
  codeBlocked: boolean;
  attempts: number;
  /** Earlier requests and decisions, newest first. */
  history: { action: string; state_code: string | null; note: string | null; created_at: Date }[];
};

export async function getSignals(userId: string): Promise<Signals | null> {
  const [u] = await sql<
    { state: string | null; state_code: string | null; full_name: string | null; signup_ip_hash: string | null; referred_by: string | null; verification_attempts: number }[]
  >`SELECT state, state_code, full_name, signup_ip_hash, referred_by, verification_attempts FROM users WHERE id = ${userId}`;
  if (!u) return null;

  const [photoMatches, sameName, [network], networkReferrals, [blocked], history] = await Promise.all([
    sql<Signals["photoMatches"]>`
      SELECT DISTINCT ON (o.id) o.id, o.nickname, o.verification_status AS status, (f2.sha256 = f1.sha256) AS exact
      FROM id_card_fingerprints f1
      JOIN id_card_fingerprints f2 ON f2.user_id <> f1.user_id
        AND (f2.sha256 = f1.sha256
             OR (f1.dhash IS NOT NULL AND f2.dhash IS NOT NULL AND bit_count((f1.dhash # f2.dhash)::bit(64)) <= 6))
      JOIN users o ON o.id = f2.user_id
      WHERE f1.user_id = ${userId}
      ORDER BY o.id, (f2.sha256 = f1.sha256) DESC
      LIMIT 20
    `,
    u.full_name && u.state
      ? sql<Signals["sameName"]>`
          SELECT id, nickname, verification_status AS status FROM users
          WHERE id <> ${userId} AND state = ${u.state} AND lower(full_name) = lower(${u.full_name})
          LIMIT 20
        `
      : Promise.resolve([]),
    u.signup_ip_hash
      ? sql<Signals["network"][]>`
          SELECT count(*)::int AS total,
                 count(*) FILTER (WHERE verification_status = 'verified')::int AS verified,
                 count(*) FILTER (WHERE verification_status = 'pending')::int AS pending
          FROM users WHERE signup_ip_hash = ${u.signup_ip_hash} AND id <> ${userId}
        `
      : Promise.resolve([{ total: 0, verified: 0, pending: 0 }]),
    u.signup_ip_hash
      ? sql<Signals["networkReferrals"]>`
          SELECT id, nickname FROM users
          WHERE signup_ip_hash = ${u.signup_ip_hash} AND id <> ${userId}
            AND (referred_by = ${userId} OR id = ${u.referred_by ?? userId})
          LIMIT 20
        `
      : Promise.resolve([]),
    u.state_code ? sql`SELECT 1 FROM blocked_state_codes WHERE code = ${u.state_code}` : Promise.resolve([]),
    sql<Signals["history"]>`
      SELECT action, state_code, note, created_at FROM verification_events WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 10
    `,
  ]);

  return {
    photoMatches,
    sameName,
    network,
    networkReferrals,
    codeProblem: u.state_code ? stateCodeProblem(u.state, u.state_code) : null,
    codeBlocked: Boolean(blocked),
    attempts: u.verification_attempts,
    history,
  };
}
