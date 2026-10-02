"use server";

import { revalidatePath } from "next/cache";
import { sql, transaction } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { normalizeNigerianPhone } from "@/lib/validate";
import { BANKS, type RewardKind } from "@/lib/reward-meta";

export type ClaimState = { error?: string; ok?: boolean } | undefined;

/**
 * Claim a reward (unclaimed → claimed) or change the payout details while it's still claimed.
 * Only the owner can do this; flagged users can't. Details lock once the admin starts processing.
 */
export async function claimReward(_prev: ClaimState, fd: FormData): Promise<ClaimState> {
  const user = await getCurrentUser();
  if (!user || !user.completed_at) return { error: "Log in again to claim." };
  if (user.is_flagged) return { error: "Your account is under review, so rewards can't be claimed right now." };
  const rewardId = String(fd.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(rewardId)) return { error: "Something went wrong. Refresh and try again." };

  const [reward] = await sql<{ kind: RewardKind; status: string }[]>`
    SELECT kind, status FROM rewards WHERE id = ${rewardId} AND user_id = ${user.id}
  `;
  if (!reward) return { error: "Something went wrong. Refresh and try again." };
  if (reward.status === "processing" || reward.status === "paid") return { error: "Payment is in progress, so details can't be changed." };
  if (reward.status !== "unclaimed" && reward.status !== "claimed") return { error: "This reward can't be claimed right now." };

  let details: { payout_bank: string | null; payout_account_number: string | null; payout_account_name: string | null; payout_phone: string | null };
  let summary: Record<string, string>;
  if (reward.kind === "cash") {
    const choice = String(fd.get("bank") ?? "");
    const bank = choice === "Other" ? String(fd.get("bank_other") ?? "").trim().replace(/\s+/g, " ") : choice;
    const account = String(fd.get("account_number") ?? "").replace(/\s/g, "");
    const name = String(fd.get("account_name") ?? "").trim().replace(/\s+/g, " ");
    if (choice === "Other" ? bank.length < 2 || bank.length > 40 : !(BANKS as readonly string[]).includes(bank)) {
      return { error: choice === "Other" ? "Type your bank's name." : "Choose your bank." };
    }
    if (!/^\d{10}$/.test(account)) return { error: "Account number must be exactly 10 digits." };
    if (name.length < 2 || name.length > 80) return { error: "Enter the account name (2 to 80 characters)." };
    details = { payout_bank: bank, payout_account_number: account, payout_account_name: name, payout_phone: null };
    // The audit trail keeps only the bank and last 4 digits, never the full account number.
    summary = { bank, account_last4: account.slice(-4) };
  } else {
    const phone = normalizeNigerianPhone(String(fd.get("phone") ?? ""));
    if (!phone) return { error: "Enter a valid Nigerian phone number." };
    details = { payout_bank: null, payout_account_number: null, payout_account_name: null, payout_phone: phone };
    summary = { phone_last4: phone.slice(-4) };
  }

  const action = reward.status === "unclaimed" ? "claimed" : "details_edited";
  const ok = await transaction(async (tx) => {
    // Status is checked again here, so a claim can't slip in after the admin starts processing.
    const [row] = await tx`
      UPDATE rewards SET ${tx(details)}, status = 'claimed', claimed_at = COALESCE(claimed_at, now())
      WHERE id = ${rewardId} AND user_id = ${user.id} AND status = ${reward.status}
      RETURNING id
    `;
    if (!row) return false;
    await tx`
      INSERT INTO reward_events (reward_id, actor, action, detail)
      VALUES (${rewardId}, 'user', ${action}, ${tx.json({ from: reward.status, ...summary })})
    `;
    if (reward.kind === "cash") {
      // Remembered to prefill the next claim. Private: only read on this user's Rewards page.
      await tx`
        UPDATE users SET payout_bank = ${details.payout_bank}, payout_account_number = ${details.payout_account_number},
          payout_account_name = ${details.payout_account_name}
        WHERE id = ${user.id}
      `;
    }
    return true;
  });
  if (!ok) return { error: "This reward just changed. Refresh to see the latest." };

  revalidatePath("/rewards");
  revalidatePath("/home");
  revalidatePath("/admin/rewards");
  return { ok: true };
}
