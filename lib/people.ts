import "server-only";
import { sql } from "./db";
import { ranked } from "./ranking";
import { getUserBadges } from "./badges";
import type { BadgeInfo } from "./badge-meta";

/**
 * What any signed-in user can see about another: the same public info shown in lists
 * (nickname, photo, state, position) plus badges, friends invited and when they joined.
 * Never contact details, state codes or anything else private.
 */
export type PublicProfile = {
  id: string;
  nickname: string;
  photo_version: number;
  state: string | null;
  /** Null for seed accounts (never ranked). */
  position: number | null;
  refs: number;
  joined: string;
  verified: boolean;
  badges: (BadgeInfo & { description: string })[];
};

/** Null for unknown, banned or unfinished accounts. */
export async function getPublicProfile(id: string): Promise<PublicProfile | null> {
  const [[row], badges] = await Promise.all([
    sql<Omit<PublicProfile, "badges">[]>`
      ${ranked()}
      SELECT u.id, u.nickname, u.photo_version, u.state, r.position, COALESCE(r.refs, 0)::int AS refs,
             u.completed_at::text AS joined,
             (u.verification_status = 'verified' AND NOT u.is_flagged) AS verified
      FROM users u LEFT JOIN ranked r ON r.id = u.id
      WHERE u.id = ${id} AND u.completed_at IS NOT NULL AND NOT u.is_banned
    `,
    getUserBadges(id),
  ]);
  if (!row) return null;
  return {
    ...row,
    badges: badges.map(({ slug, name, icon, color, description }) => ({ slug, name, icon, color, description })),
  };
}
