"use server";

import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { track } from "@/lib/stats";

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

const validSub = (s: Sub) =>
  typeof s?.endpoint === "string" && /^https:\/\//.test(s.endpoint) && s.endpoint.length < 1000 &&
  typeof s.keys?.p256dh === "string" && s.keys.p256dh.length < 200 &&
  typeof s.keys?.auth === "string" && s.keys.auth.length < 100;

/** Saves this browser's push subscription for the signed-in user (moving it over if someone else used it). */
export async function savePushSubscription(sub: Sub): Promise<{ ok: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user?.completed_at) return { error: "Log in first." };
  if (!validSub(sub)) return { error: "This browser can't get notifications." };
  const [row] = await sql<{ inserted: boolean }[]>`
    INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth)
    VALUES (${sub.endpoint}, ${user.id}, ${sub.keys.p256dh}, ${sub.keys.auth})
    ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
    RETURNING (xmax = 0) AS inserted
  `;
  if (row.inserted) await track("push_enabled", user.id);
  return { ok: true };
}

/** Turns notifications off for this browser. */
export async function removePushSubscription(endpoint: string) {
  const user = await getCurrentUser();
  if (!user) return;
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND user_id = ${user.id}`;
  await track("push_disabled", user.id);
}
