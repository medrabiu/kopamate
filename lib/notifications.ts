import "server-only";
import { unstable_cache } from "next/cache";
import type { AnnouncementKind } from "./announcement-meta";
import { sql } from "./db";

/**
 * The bell on Home. Personal notifications are written by database triggers (db/schema.sql: follows, badges,
 * rewards, friends joining); announcements come from the Kopamate team. Anything newer than
 * users.notifications_seen_at is unread.
 */

export type Announcement = {
  id: string;
  kind: AnnouncementKind;
  title: string;
  body: string | null;
  button_label: string | null;
  button_url: string | null;
  pinned: boolean;
  /** When it was first shown to users (hidden drafts have none). */
  published_at: Date;
};

export type Notification = {
  id: string;
  kind: "follow" | "badge" | "reward" | "paid" | "friend" | "challenge" | "hi_request" | "hi_accepted" | "school_joined";
  title: string;
  body: string | null;
  url: string | null;
  created_at: Date;
  actor: { id: string; nickname: string; photo_version: number } | null;
  /** "Say hi" requests: the request id and whether it's still waiting. */
  connection: { id: number; status: string } | null;
  /** The viewer already follows the actor (for "Follow back"). */
  following_actor: boolean;
};

/** Visible ones, newest first. Cached for a minute; admin changes clear it (tag "announcements"). */
export const getAnnouncements = unstable_cache(
  async (limit: number) =>
    sql<Announcement[]>`
      SELECT id::text, kind, title, body, button_label, button_url, pinned, published_at
      FROM announcements WHERE visible ORDER BY published_at DESC, id DESC LIMIT ${limit}
    `,
  ["announcements"],
  { revalidate: 60, tags: ["announcements"] },
);

/** Unread personal notifications plus announcements, since the user last opened the bell. */
export async function getUnreadCount(userId: string) {
  const [row] = await sql<{ n: number }[]>`
    WITH seen AS (SELECT notifications_seen_at AS at FROM users WHERE id = ${userId})
    SELECT
      (SELECT count(*) FROM notifications n, seen WHERE n.user_id = ${userId} AND n.created_at > seen.at
         AND NOT EXISTS (SELECT 1 FROM blocks bl WHERE (bl.blocker_id = ${userId} AND bl.blocked_id = n.actor_id)
                                                   OR (bl.blocker_id = n.actor_id AND bl.blocked_id = ${userId})))::int +
      (SELECT count(*) FROM announcements a, seen WHERE a.visible AND a.published_at > seen.at)::int AS n
  `;
  return row?.n ?? 0;
}

/**
 * The last 30 days, newest first. The person each one is about comes along; banned people and anyone blocked
 * either way are left out. "Say hi" requests carry their current state, so Accept / Ignore only shows while waiting.
 */
export async function getNotifications(userId: string) {
  return sql<Notification[]>`
    SELECT n.id::text, n.kind, n.title, n.body, n.url, n.created_at,
           CASE WHEN a.id IS NULL THEN NULL
                ELSE json_build_object('id', a.id, 'nickname', a.nickname, 'photo_version', a.photo_version) END AS actor,
           CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('id', c.id, 'status', c.status) END AS connection,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${userId} AND f.following_id = n.actor_id) AS following_actor
    FROM notifications n
    LEFT JOIN users a ON a.id = n.actor_id AND NOT a.is_banned
    LEFT JOIN connections c ON n.kind = 'hi_request' AND c.id = (n.data->>'connection')::bigint
    WHERE n.user_id = ${userId} AND n.created_at > now() - interval '30 days'
      AND (n.actor_id IS NULL OR a.id IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM blocks bl WHERE (bl.blocker_id = ${userId} AND bl.blocked_id = n.actor_id)
                                                OR (bl.blocker_id = n.actor_id AND bl.blocked_id = ${userId}))
    ORDER BY n.created_at DESC, n.id DESC
    LIMIT 50
  `;
}
