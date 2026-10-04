"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { creditTaskReward, TASK_REWARDS } from "@/lib/hustle/wallet";
import { getCurrentUser } from "@/lib/session";

/** Follow or unfollow someone. Returns their new follower count, or an error. */
export async function setFollow(targetId: string, follow: boolean): Promise<{ followers: number } | { error: string }> {
  const user = await getCurrentUser();
  if (!user?.completed_at) return { error: "Log in to follow corpers." };
  if (!/^[0-9a-f-]{36}$/i.test(targetId) || targetId === user.id) return { error: "You can't follow this account." };

  if (follow) {
    // Only real, finished, not-banned accounts can be followed; following twice does nothing.
    const added = await sql`
      INSERT INTO follows (follower_id, following_id)
      SELECT ${user.id}, id FROM users WHERE id = ${targetId} AND completed_at IS NOT NULL AND NOT is_banned
      ON CONFLICT DO NOTHING RETURNING 1
    `;
    // My Hustle task reward: once per person ever followed, within the daily cap.
    if (added.length) await creditTaskReward(user.id, "follow", TASK_REWARDS.follow, targetId);
  } else {
    await sql`DELETE FROM follows WHERE follower_id = ${user.id} AND following_id = ${targetId}`;
  }
  const [row] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM follows f JOIN users x ON x.id = f.follower_id
    WHERE f.following_id = ${targetId} AND NOT x.is_banned
  `;
  // Your own Following count on Profile changes too.
  revalidatePath("/profile");
  return { followers: row.n };
}
