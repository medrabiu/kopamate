"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isState } from "@/lib/states";
import { getEarlyDeadline } from "@/lib/stats";
import { checkAutoBadges } from "@/lib/badges";

export type VoteState = { error?: string; ok?: boolean } | undefined;

/** "Which state will have the most corpers when camp ends?" Votes can change until the Early Corper deadline. */
export async function voteState(state: string): Promise<VoteState> {
  const user = await getCurrentUser();
  if (!user || !user.completed_at) redirect("/login");
  if (!isState(state)) return { error: "Choose a state." };
  if (Date.now() >= new Date(await getEarlyDeadline()).getTime()) return { error: "Predictions are locked." };
  await sql`
    INSERT INTO state_predictions (user_id, state) VALUES (${user.id}, ${state})
    ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, created_at = now()
  `;
  // Voting can complete the profile; the page celebrates the new badge when it re-renders.
  await checkAutoBadges(user.id);
  revalidateTag("predictions");
  revalidatePath("/rewards");
  revalidatePath("/home");
  return { ok: true };
}
