"use server";

import { revalidatePath } from "next/cache";
import { transaction } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getBonusSettings, recordBonuses } from "@/lib/referral-bonus";
import { formatNgn, REWARD_KINDS, type RewardKind } from "@/lib/reward-meta";

export type WithdrawState = { error?: string; ok?: boolean } | undefined;

/**
 * Turns the referral balance into one unclaimed reward (cash, airtime or data) that the user then claims
 * on Rewards like any other. Needs a verified account and at least the minimum balance.
 */
export async function withdrawBonus(_prev: WithdrawState, fd: FormData): Promise<WithdrawState> {
  const user = await getCurrentUser();
  if (!user?.completed_at) return { error: "Log in again to withdraw." };
  if (user.is_flagged) return { error: "Your account is under review, so earnings can't be withdrawn right now." };
  if (user.verification_status !== "verified") return { error: "Get verified in Profile to withdraw your earnings." };
  const kindRaw = String(fd.get("kind") ?? "");
  const kind: RewardKind = (REWARD_KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as RewardKind) : "cash";

  await recordBonuses({ referrerId: user.id });
  const { minWithdraw } = await getBonusSettings();

  const result = await transaction(async (tx) => {
    // Lock the unwithdrawn bonuses so two taps can't withdraw the same naira twice.
    const rows = await tx<{ referred_id: string; amount_ngn: number }[]>`
      SELECT b.referred_id, b.amount_ngn FROM referral_bonuses b JOIN users r ON r.id = b.referred_id
      WHERE b.referrer_id = ${user.id} AND b.reward_id IS NULL
        AND r.verification_status = 'verified' AND NOT r.is_flagged AND NOT r.is_banned
      FOR UPDATE OF b
    `;
    const total = rows.reduce((s, r) => s + r.amount_ngn, 0);
    if (total === 0) return { error: "You have no earnings to withdraw yet." };
    if (total < minWithdraw) return { error: `You can withdraw once you have ${formatNgn(minWithdraw)}.` };
    const [reward] = await tx<{ id: string }[]>`
      INSERT INTO rewards (user_id, title, description, kind, amount_ngn, status, batch_id)
      VALUES (${user.id}, 'Referral earnings',
              ${`For ${rows.length} verified ${rows.length === 1 ? "friend" : "friends"} you invited`},
              ${kind}, ${total}, 'unclaimed', 'referral-bonus')
      RETURNING id
    `;
    await tx`
      UPDATE referral_bonuses SET reward_id = ${reward.id}
      WHERE referred_id IN ${tx(rows.map((r) => r.referred_id))}
    `;
    await tx`
      INSERT INTO reward_events (reward_id, actor, action, detail)
      VALUES (${reward.id}, 'user', 'awarded', ${tx.json({ source: "referral_bonus", friends: rows.length, amount: total, kind } as never)})
    `;
    return { ok: true as const };
  });
  if ("error" in result) return result;

  revalidatePath("/invite");
  revalidatePath("/rewards");
  revalidatePath("/home");
  revalidatePath("/admin/rewards");
  return { ok: true };
}
