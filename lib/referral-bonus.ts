import "server-only";
import { sql } from "./db";

/**
 * Referral bonus: the inviter earns `rate` naira for every friend who joins with their link and gets
 * verified. Each bonus keeps the rate from when it was earned. Unwithdrawn bonuses make a balance the
 * inviter withdraws as one normal reward (app/actions/referral-bonus.ts).
 *
 * Only real referrals count: neither person flagged, banned or a seed account (the same rule as positions).
 */

export const DEFAULT_BONUS_NGN = 250;
export const DEFAULT_MIN_WITHDRAW_NGN = 1000;

export type BonusSettings = {
  /** Switched on in Admin → Settings. Off: no new bonuses are earned; existing balances can still be withdrawn. */
  enabled: boolean;
  rate: number;
  minWithdraw: number;
};

export async function getBonusSettings(): Promise<BonusSettings> {
  const rows = await sql<{ key: string; value: string }[]>`
    SELECT key, value FROM settings WHERE key IN ('referral_bonus_enabled', 'referral_bonus_ngn', 'referral_bonus_min_withdraw_ngn')
  `;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (key: string, fallback: number) => {
    const v = map.get(key);
    const n = Number(v);
    return v !== undefined && v !== "" && Number.isInteger(n) && n >= 0 ? n : fallback;
  };
  return {
    // The ₦250 referral campaign ended in October 2026: no new bonuses, whatever the old setting says.
    // People keep what they earned and can still withdraw it (rate and minimum below still apply).
    enabled: false,
    rate: num("referral_bonus_ngn", DEFAULT_BONUS_NGN),
    minWithdraw: num("referral_bonus_min_withdraw_ngn", DEFAULT_MIN_WITHDRAW_NGN),
  };
}

/**
 * Records bonuses that are due but not stored yet, at today's rate. Safe to run any time (each invited
 * friend earns once). Scope it to one inviter, or to the friend who just got verified.
 */
export async function recordBonuses(scope: { referrerId: string } | { referredId: string }) {
  const { enabled, rate } = await getBonusSettings();
  if (!enabled || rate <= 0) return;
  await sql`
    INSERT INTO referral_bonuses (referred_id, referrer_id, amount_ngn)
    SELECT r.id, r.referred_by, ${rate}
    FROM users r JOIN users p ON p.id = r.referred_by
    WHERE r.verification_status = 'verified' AND r.completed_at IS NOT NULL
      AND NOT r.is_flagged AND NOT r.is_banned AND NOT r.is_seed
      AND NOT p.is_flagged AND NOT p.is_banned AND NOT p.is_seed
      AND ${"referrerId" in scope ? sql`r.referred_by = ${scope.referrerId}` : sql`r.id = ${scope.referredId}`}
    ON CONFLICT (referred_id) DO NOTHING
  `;
}

/** A friend's verification was removed: their bonus goes too, unless it was already withdrawn. */
export async function dropBonus(referredId: string) {
  await sql`DELETE FROM referral_bonuses WHERE referred_id = ${referredId} AND reward_id IS NULL`;
}

export type FriendBonus = {
  id: string;
  /** "earned": counts toward the balance; "paid": withdrawn; "waiting": not verified yet; "none": doesn't count. */
  status: "earned" | "paid" | "waiting" | "none";
  amount: number | null;
};

export type Earnings = BonusSettings & {
  available: number;
  withdrawn: number;
  /** Bonuses that count toward the balance or were withdrawn. */
  earnedCount: number;
  friends: Map<string, FriendBonus>;
};

/**
 * The inviter's balance and every invited friend's bonus status. Records any bonuses that are due first,
 * so referrals verified before the feature existed are counted too.
 */
export async function getEarnings(referrerId: string): Promise<Earnings> {
  await recordBonuses({ referrerId });
  const [settings, rows] = await Promise.all([
    getBonusSettings(),
    sql<{ id: string; verified: boolean; counts: boolean; amount_ngn: number | null; reward_id: string | null }[]>`
      SELECT r.id, (r.verification_status = 'verified') AS verified,
             (NOT r.is_flagged AND NOT r.is_banned AND NOT r.is_seed) AS counts,
             b.amount_ngn, b.reward_id
      FROM users r LEFT JOIN referral_bonuses b ON b.referred_id = r.id AND b.referrer_id = ${referrerId}
      WHERE r.referred_by = ${referrerId} AND r.completed_at IS NOT NULL
    `,
  ]);
  const friends = new Map<string, FriendBonus>();
  let available = 0;
  let withdrawn = 0;
  let earnedCount = 0;
  for (const r of rows) {
    if (r.amount_ngn !== null && r.reward_id) {
      withdrawn += r.amount_ngn;
      earnedCount++;
      friends.set(r.id, { id: r.id, status: "paid", amount: r.amount_ngn });
    } else if (r.amount_ngn !== null && r.counts && r.verified) {
      available += r.amount_ngn;
      earnedCount++;
      friends.set(r.id, { id: r.id, status: "earned", amount: r.amount_ngn });
    } else {
      friends.set(r.id, { id: r.id, status: r.counts && !r.verified ? "waiting" : "none", amount: null });
    }
  }
  return { ...settings, available, withdrawn, earnedCount, friends };
}
