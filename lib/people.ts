import "server-only";
import { sql } from "./db";

/**
 * What any signed-in user can see about another: a normal profile. Nickname, photo, state, when they
 * joined, whether they're verified, and follows. No position, referrals, badges, contact details,
 * state codes or anything else private.
 */
export type PublicProfile = {
  id: string;
  nickname: string;
  photo_version: number;
  state: string | null;
  joined: string;
  verified: boolean;
  followers: number;
  following: number;
  /** The viewer follows this person. */
  is_following: boolean;
  /** This person follows the viewer. */
  follows_you: boolean;
};

/** Null for unknown, banned or unfinished accounts. `viewerId` is null for logged-out visitors (profile links). */
export async function getPublicProfile(id: string, viewerId: string | null): Promise<PublicProfile | null> {
  return findProfile(sql`u.id = ${id}`, viewerId);
}

/** The person behind a profile link (/u/<code>); the code is their invite code. */
export async function getProfileByCode(code: string, viewerId: string | null) {
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!clean) return null;
  return findProfile(sql`u.referral_code = ${clean}`, viewerId);
}

async function findProfile(where: ReturnType<typeof sql>, viewerId: string | null): Promise<PublicProfile | null> {
  const viewer = viewerId ?? "00000000-0000-0000-0000-000000000000";
  const [row] = await sql<PublicProfile[]>`
    SELECT u.id, u.nickname, u.photo_version, u.state, u.completed_at::text AS joined,
           (u.verification_status = 'verified' AND NOT u.is_flagged) AS verified,
           (SELECT count(*)::int FROM follows f JOIN users x ON x.id = f.follower_id
              WHERE f.following_id = u.id AND NOT x.is_banned) AS followers,
           (SELECT count(*)::int FROM follows f JOIN users x ON x.id = f.following_id
              WHERE f.follower_id = u.id AND NOT x.is_banned) AS following,
           EXISTS (SELECT 1 FROM follows WHERE follower_id = ${viewer} AND following_id = u.id) AS is_following,
           EXISTS (SELECT 1 FROM follows WHERE follower_id = u.id AND following_id = ${viewer}) AS follows_you
    FROM users u
    WHERE ${where} AND u.completed_at IS NOT NULL AND NOT u.is_banned
  `;
  return row ?? null;
}

export type FollowRow = { id: string; nickname: string; photo_version: number; state: string | null };

/** Who follows someone, or who they follow, newest first (banned and unfinished accounts left out). */
export async function getFollowList(id: string, list: "followers" | "following", limit = 200): Promise<FollowRow[]> {
  return list === "followers"
    ? sql<FollowRow[]>`
        SELECT u.id, u.nickname, u.photo_version, u.state FROM follows f JOIN users u ON u.id = f.follower_id
        WHERE f.following_id = ${id} AND NOT u.is_banned AND u.completed_at IS NOT NULL
        ORDER BY f.created_at DESC LIMIT ${limit}
      `
    : sql<FollowRow[]>`
        SELECT u.id, u.nickname, u.photo_version, u.state FROM follows f JOIN users u ON u.id = f.following_id
        WHERE f.follower_id = ${id} AND NOT u.is_banned AND u.completed_at IS NOT NULL
        ORDER BY f.created_at DESC LIMIT ${limit}
      `;
}

/** Follower and following counts for the signed-in user's own Profile page. */
export async function getFollowCounts(id: string): Promise<{ followers: number; following: number }> {
  const [row] = await sql<{ followers: number; following: number }[]>`
    SELECT (SELECT count(*)::int FROM follows f JOIN users x ON x.id = f.follower_id
              WHERE f.following_id = ${id} AND NOT x.is_banned) AS followers,
           (SELECT count(*)::int FROM follows f JOIN users x ON x.id = f.following_id
              WHERE f.follower_id = ${id} AND NOT x.is_banned) AS following
  `;
  return row;
}
