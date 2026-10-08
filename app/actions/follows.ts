"use server";

import { follow } from "./social";

/** Follow or unfollow someone (the Follow button). Returns their new follower count, or an error. */
export async function setFollow(targetId: string, on: boolean): Promise<{ followers: number } | { error: string }> {
  const r = await follow(targetId, on);
  return r.ok ? { followers: r.followers } : { error: r.error };
}
