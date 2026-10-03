import "server-only";
import webpush from "web-push";
import { sql } from "./db";

/**
 * Web push. Needs VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (make a pair with `npx web-push generate-vapid-keys`).
 * Without them nothing is sent and the app hides the "turn on notifications" prompts.
 */
const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
export const pushEnabled = Boolean(publicKey && privateKey);
export const vapidPublicKey = pushEnabled ? publicKey : null;

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@kopamate.ng", publicKey, privateKey);
  configured = true;
}

export type PushMessage = {
  title: string;
  body: string;
  /** Page opened when the notification is tapped. */
  url: string;
  /** Notifications with the same tag replace each other instead of piling up. */
  tag?: string;
};

/** Sends to every browser the users turned notifications on in. Dead subscriptions are removed. Never throws. */
export async function sendPush(userIds: string | string[], message: PushMessage) {
  if (!pushEnabled) return 0;
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  if (ids.length === 0) return 0;
  configure();
  try {
    const subs = await sql<{ endpoint: string; p256dh: string; auth: string }[]>`
      SELECT s.endpoint, s.p256dh, s.auth FROM push_subscriptions s JOIN users u ON u.id = s.user_id
      WHERE s.user_id = ANY(${ids}::uuid[]) AND NOT u.is_banned
    `;
    const payload = JSON.stringify(message);
    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 12 * 3600 }),
      ),
    );
    // 404/410: the browser dropped the subscription (app removed, permission revoked).
    const gone = subs.filter((_, i) => {
      const r = results[i];
      return r.status === "rejected" && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0);
    });
    if (gone.length) await sql`DELETE FROM push_subscriptions WHERE endpoint = ANY(${gone.map((s) => s.endpoint)})`;
    return results.filter((r) => r.status === "fulfilled").length;
  } catch {
    // Notifications must never break the action that triggered them.
    return 0;
  }
}

/** A friend finished sign-up with this user's link. `freeze`: it earned them a streak freeze. */
export async function notifyFriendJoined(referrerId: string, friendNickname: string, freeze: boolean) {
  await sendPush(referrerId, {
    title: `🎉 ${friendNickname} joined with your link`,
    body: freeze ? "You earned a streak freeze 🧊" : "Your friends are on Kopamate now.",
    url: "/home",
    tag: "friend",
  });
}
