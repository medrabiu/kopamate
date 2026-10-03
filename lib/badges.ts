import "server-only";
import type { PendingQuery, Row } from "postgres";
import { sql } from "./db";
import { getEarlyDeadline } from "./stats";
import type { BadgeInfo } from "./badge-meta";

/**
 * Badges.
 * - Auto badges (early_corper, first_invite, profile_complete) are given by checkAutoBadges, which is
 *   safe to call as often as you like: it only inserts what's missing and never brings back a revoked badge.
 * - Manual badges (prophet, state_ambassador) are given by an admin.
 * - Flagged or banned users' badges are hidden everywhere and never count for rewards.
 */

export type UserBadge = BadgeInfo & {
  priority: number;
  qualifies_for_rewards: boolean;
  awarded_at: Date;
};

export type Badge = BadgeInfo & { priority: number; kind: "auto" | "manual"; qualifies_for_rewards: boolean };

/**
 * A user's highest-priority active badge as {slug, name, icon, color}, or null.
 * Use inside a SELECT where the users table is aliased `u`: sql`SELECT u.id, ${topBadge()} FROM users u`.
 */
export const topBadge = () => sql`
  (SELECT jsonb_build_object('slug', b.slug, 'name', b.name, 'description', b.description, 'icon', b.icon, 'color', b.color)
   FROM user_badges ub JOIN badges b ON b.slug = ub.badge_slug
   WHERE ub.user_id = u.id AND ub.revoked_at IS NULL AND NOT u.is_flagged AND NOT u.is_banned
   ORDER BY b.priority DESC LIMIT 1) AS top_badge
`;

/**
 * Whether the user has the verified check (admin checked their NYSC ID, and they aren't flagged), as `verified`.
 * Use inside a SELECT where the users table is aliased `u`.
 */
export const isVerified = () => sql`(u.verification_status = 'verified' AND NOT u.is_flagged) AS verified`;

export async function getAllBadges(): Promise<Badge[]> {
  return sql<Badge[]>`
    SELECT slug, name, description, icon, color, priority, kind, qualifies_for_rewards FROM badges ORDER BY priority DESC
  `;
}

/** Active badges, highest priority first. Empty for flagged or banned users. */
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  return sql<UserBadge[]>`
    SELECT b.slug, b.name, b.description, b.icon, b.color, b.priority, b.qualifies_for_rewards, ub.awarded_at
    FROM user_badges ub
    JOIN badges b ON b.slug = ub.badge_slug
    JOIN users u ON u.id = ub.user_id
    WHERE ub.user_id = ${userId} AND ub.revoked_at IS NULL AND NOT u.is_flagged AND NOT u.is_banned
    ORDER BY b.priority DESC
  `;
}

/** Gives a badge. Does nothing if the user already has it, including when it was revoked. */
export async function awardBadge(userId: string, slug: string, awardedBy = "system") {
  await sql`
    INSERT INTO user_badges (user_id, badge_slug, awarded_by) VALUES (${userId}, ${slug}, ${awardedBy})
    ON CONFLICT (user_id, badge_slug) DO NOTHING
  `;
}

export async function revokeBadge(userId: string, slug: string, reason: string) {
  await sql`
    UPDATE user_badges SET revoked_at = now(), revoked_reason = ${reason || null}
    WHERE user_id = ${userId} AND badge_slug = ${slug} AND revoked_at IS NULL
  `;
}

export async function restoreBadge(userId: string, slug: string) {
  await sql`
    UPDATE user_badges SET revoked_at = NULL, revoked_reason = NULL
    WHERE user_id = ${userId} AND badge_slug = ${slug}
  `;
}

/**
 * Facts behind the auto badges, per completed user.
 * A friend counts with the same rule as lib/ranking.ts: they finished sign-up, aren't a seed account,
 * and neither of you is flagged or banned.
 */
const autoFacts = (deadline: string, where: PendingQuery<Row[]>) => sql`
  SELECT u.id,
         (u.completed_at <= ${deadline}::timestamptz) AS early,
         (u.photo_version > 0) AS photo,
         (u.state_code IS NOT NULL AND u.state_code <> '') AS state_code,
         u.streak_best AS best_streak,
         (NOT u.is_flagged AND NOT u.is_banned AND EXISTS (
            SELECT 1 FROM users r
            WHERE r.referred_by = u.id AND r.completed_at IS NOT NULL
              AND NOT r.is_flagged AND NOT r.is_banned AND NOT r.is_seed
         )) AS friend
  FROM users u
  WHERE u.completed_at IS NOT NULL AND ${where}
`;

/**
 * Gives any auto badges the users have earned. One statement, idempotent and cheap when there's nothing new.
 * Pass "all" to run it for every completed user (the admin backfill).
 * Returns the badges that were newly given.
 */
export async function checkAutoBadges(userIds: string | (string | null | undefined)[] | "all") {
  const ids = userIds === "all" ? [] : (Array.isArray(userIds) ? userIds : [userIds]).filter((v): v is string => Boolean(v));
  if (userIds !== "all" && ids.length === 0) return [];
  const deadline = await getEarlyDeadline();
  const where = userIds === "all" ? sql`true` : sql`u.id = ANY(${ids}::uuid[])`;
  return sql<{ user_id: string; badge_slug: string }[]>`
    WITH facts AS (${autoFacts(deadline, where)}),
    earned AS (
      SELECT f.id, v.slug
      FROM facts f
      CROSS JOIN LATERAL (VALUES
        ('early_corper', f.early),
        ('first_invite', f.friend),
        ('profile_complete', f.photo AND f.state_code AND f.friend),
        ('streak_7', f.best_streak >= 7),
        ('streak_30', f.best_streak >= 30),
        ('streak_100', f.best_streak >= 100)
      ) AS v(slug, ok)
      WHERE v.ok
    )
    INSERT INTO user_badges (user_id, badge_slug, awarded_by)
    SELECT id, slug, 'system' FROM earned
    ON CONFLICT (user_id, badge_slug) DO NOTHING
    RETURNING user_id, badge_slug
  `;
}

export type ProfileSteps = { photo: boolean; stateCode: boolean; friend: boolean };

/** The profile-completion steps (photo, state code, first friend), each worth the same share. */
export async function getProfileSteps(userId: string): Promise<ProfileSteps> {
  const deadline = await getEarlyDeadline();
  const [row] = await sql<{ photo: boolean; state_code: boolean; friend: boolean }[]>`
    ${autoFacts(deadline, sql`u.id = ${userId}`)}
  `;
  return {
    photo: Boolean(row?.photo),
    stateCode: Boolean(row?.state_code),
    friend: Boolean(row?.friend),
  };
}
