import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "./db";
import { cleanLinks, waLink, type Links } from "./social-rules";
import type { Stage } from "./nysc";

/**
 * People and connecting: full profiles, follows, "Say hi", blocks. Privacy rule: a WhatsApp number never leaves
 * this file except as the wa.me link for two people with an accepted "Say hi". Emails, state codes and Google
 * ids are never selected here at all.
 */

const NOBODY = "00000000-0000-0000-0000-000000000000";

/** A user id, or a SQL fragment like sql`u.id`. */
type IdOrSql = string | ReturnType<typeof sql>;

/** SQL: true when `a` and `b` have blocked each other either way. */
export const blockedSql = (a: IdOrSql, b: IdOrSql) =>
  sql`EXISTS (SELECT 1 FROM blocks bl WHERE (bl.blocker_id = ${a} AND bl.blocked_id = ${b}) OR (bl.blocker_id = ${b} AND bl.blocked_id = ${a}))`;

/** SQL: user `u` is visible to `viewer` in lists (finished, not banned, listed, not blocked either way). */
export const visibleToSql = (viewer: string) => sql`
  u.completed_at IS NOT NULL AND NOT u.is_banned AND u.show_in_list
  AND NOT EXISTS (SELECT 1 FROM blocks bl WHERE (bl.blocker_id = ${viewer} AND bl.blocked_id = u.id) OR (bl.blocker_id = u.id AND bl.blocked_id = ${viewer}))
`;

export type ConnectionState =
  | { status: "none" }
  /** Sent by the viewer. Ignored requests also show as pending to the sender. */
  | { status: "sent"; id: number }
  /** Waiting for the viewer to accept. */
  | { status: "received"; id: number; note: string | null }
  | { status: "connected"; id: number };

export type FullProfile = {
  id: string;
  nickname: string;
  photo_version: number;
  state: string | null;
  nysc_stage: Stage;
  nysc_batch: string | null;
  joined: string;
  verified: boolean;
  bio: string | null;
  school: string | null;
  course: string | null;
  interests: string[];
  open_to: string[];
  links: Links;
  followers: number;
  following: number;
  is_following: boolean;
  follows_you: boolean;
  connection: ConnectionState;
  /** wa.me link: only when the two have an accepted "Say hi" and this person saved a number. */
  wa: string | null;
  /** Whether the viewer may send a "Say hi" (their settings allow it). */
  hi_allowed: boolean;
  /** The viewer blocked this person (only the viewer sees this, on their own Blocked list). */
  blocked_by_me: boolean;
};

type Row = Omit<FullProfile, "links" | "connection" | "wa"> & {
  links: unknown;
  show_in_list: boolean;
  blocked_any: boolean;
  wa_e164: string | null;
  c_id: number | null;
  c_status: string | null;
  c_from_me: boolean | null;
  c_note: string | null;
};

/**
 * A full profile for a signed-in viewer, in one query: the person, counts, follow flags, the "Say hi" state and
 * blocks. Null (shown as not found) for unknown, unfinished or banned accounts, for hidden ones (except your
 * own), and when either has blocked the other.
 */
export async function getFullProfile(userId: string, viewerId: string): Promise<FullProfile | null> {
  const [r] = await sql<Row[]>`
    WITH c AS (
      SELECT id, status, from_id = ${viewerId} AS from_me, note FROM connections
      WHERE ((from_id = ${viewerId} AND to_id = ${userId}) OR (from_id = ${userId} AND to_id = ${viewerId}))
        AND (status IN ('pending', 'accepted') OR (status = 'declined' AND from_id = ${viewerId} AND created_at > now() - interval '30 days'))
      ORDER BY (status = 'accepted') DESC, created_at DESC LIMIT 1
    )
    SELECT u.id, u.nickname, u.photo_version, u.state, u.nysc_stage, u.nysc_batch, u.completed_at::text AS joined,
           (u.verification_status = 'verified' AND NOT u.is_flagged) AS verified,
           u.bio, u.school, u.course, u.interests, u.open_to, u.links, u.show_in_list,
           (SELECT count(*)::int FROM follows f JOIN users x ON x.id = f.follower_id WHERE f.following_id = u.id AND NOT x.is_banned) AS followers,
           (SELECT count(*)::int FROM follows f JOIN users x ON x.id = f.following_id WHERE f.follower_id = u.id AND NOT x.is_banned) AS following,
           EXISTS (SELECT 1 FROM follows WHERE follower_id = ${viewerId} AND following_id = u.id) AS is_following,
           EXISTS (SELECT 1 FROM follows WHERE follower_id = u.id AND following_id = ${viewerId}) AS follows_you,
           ${blockedSql(viewerId, sql`u.id`)} AS blocked_any,
           EXISTS (SELECT 1 FROM blocks WHERE blocker_id = ${viewerId} AND blocked_id = u.id) AS blocked_by_me,
           (u.hi_policy = 'everyone' OR (u.hi_policy = 'following' AND EXISTS (SELECT 1 FROM follows WHERE follower_id = u.id AND following_id = ${viewerId}))) AS hi_allowed,
           CASE WHEN (SELECT status FROM c) = 'accepted' THEN u.whatsapp_e164 END AS wa_e164,
           (SELECT id FROM c)::int AS c_id, (SELECT status FROM c) AS c_status, (SELECT from_me FROM c) AS c_from_me, (SELECT note FROM c) AS c_note
    FROM users u
    WHERE u.id = ${userId} AND u.completed_at IS NOT NULL AND NOT u.is_banned
  `;
  if (!r) return null;
  const own = r.id === viewerId;
  if (!own && (r.blocked_any || !r.show_in_list)) return null;
  let connection: ConnectionState = { status: "none" };
  if (r.c_id && r.c_status === "accepted") connection = { status: "connected", id: r.c_id };
  else if (r.c_id && r.c_from_me) connection = { status: "sent", id: r.c_id };
  else if (r.c_id && r.c_status === "pending") connection = { status: "received", id: r.c_id, note: r.c_note };
  const { wa_e164, c_id, c_status, c_from_me, c_note, show_in_list, blocked_any, links, ...rest } = r;
  void c_id, c_status, c_from_me, c_note, show_in_list, blocked_any;
  return { ...rest, links: cleanLinks(links), connection, wa: !own && connection.status === "connected" && wa_e164 ? waLink(wa_e164) : null };
}

export type Resolved =
  | { kind: "user"; id: string; nickname: string; referral_code: string }
  | { kind: "redirect"; nickname: string }
  | { kind: "code"; id: string; nickname: string; referral_code: string }
  | null;

/**
 * Who a /u/<segment> link means: "@name" is a username (or an old one, redirecting for 30 days), a uuid is a
 * user id (old in-app links), anything else is an invite code (share links).
 */
export async function resolveProfilePath(segment: string, handle: string | null): Promise<Resolved> {
  if (handle) {
    const [u] = await sql<{ id: string; nickname: string; referral_code: string }[]>`
      SELECT id, nickname, referral_code FROM users WHERE lower(nickname) = lower(${handle}) AND completed_at IS NOT NULL AND NOT is_banned
    `;
    if (u) return { kind: "user", ...u };
    const [r] = await sql<{ nickname: string }[]>`
      SELECT u.nickname FROM username_redirects r JOIN users u ON u.id = r.user_id
      WHERE r.old_name = lower(${handle}) AND r.expires_at > now() AND NOT u.is_banned
    `;
    return r ? { kind: "redirect", nickname: r.nickname } : null;
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    const [u] = await sql<{ id: string; nickname: string }[]>`
      SELECT id, nickname FROM users WHERE id = ${segment} AND completed_at IS NOT NULL AND NOT is_banned
    `;
    return u ? { kind: "redirect", nickname: u.nickname } : null;
  }
  const code = segment.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!code) return null;
  const [u] = await sql<{ id: string; nickname: string; referral_code: string }[]>`
    SELECT id, nickname, referral_code FROM users WHERE referral_code = ${code} AND completed_at IS NOT NULL AND NOT is_banned
  `;
  return u ? { kind: "code", ...u } : null;
}

export type PersonCard = {
  id: string;
  nickname: string;
  photo_version: number;
  state: string | null;
  school: string | null;
  verified: boolean;
  is_following: boolean;
};

const cardCols = (viewer: string) => sql`
  u.id, u.nickname, u.photo_version, u.state, u.school, (u.verification_status = 'verified' AND NOT u.is_flagged) AS verified,
  EXISTS (SELECT 1 FROM follows WHERE follower_id = ${viewer} AND following_id = u.id) AS is_following
`;

export const FOLLOW_PAGE = 30;

/** Followers or following of someone, 30 a page, newest first, without anyone the viewer can't see. */
export async function getFollowPage(userId: string, list: "followers" | "following", viewerId: string, page: number) {
  const rows = await sql<PersonCard[]>`
    SELECT ${cardCols(viewerId)}
    FROM follows f JOIN users u ON u.id = ${list === "followers" ? sql`f.follower_id` : sql`f.following_id`}
    WHERE ${list === "followers" ? sql`f.following_id` : sql`f.follower_id`} = ${userId}
      AND u.completed_at IS NOT NULL AND NOT u.is_banned
      AND (u.show_in_list OR u.id = ${viewerId})
      AND NOT ${blockedSql(viewerId, sql`u.id`)}
    ORDER BY f.created_at DESC
    LIMIT ${FOLLOW_PAGE + 1} OFFSET ${(page - 1) * FOLLOW_PAGE}
  `;
  return { rows: rows.slice(0, FOLLOW_PAGE), more: rows.length > FOLLOW_PAGE };
}

export type PeopleFilters = { state?: string | null; school?: string | null; interest?: string | null; openTo?: string | null };

const filterSql = (f: PeopleFilters) => sql`
  ${f.state ? sql`AND u.state = ${f.state}` : sql``}
  ${f.school ? sql`AND lower(u.school) = lower(${f.school})` : sql``}
  ${f.interest ? sql`AND EXISTS (SELECT 1 FROM unnest(u.interests) i WHERE lower(i) = lower(${f.interest}))` : sql``}
  ${f.openTo ? sql`AND u.open_to @> ARRAY[${f.openTo}]::text[]` : sql``}
`;

/** Search by name (at least 2 characters), with optional filters. At most 20. */
export async function searchPeople(viewerId: string, q: string, filters: PeopleFilters): Promise<PersonCard[]> {
  const term = q.trim().replace(/^@/, "");
  if (term.length < 2 && !filters.school && !filters.interest && !filters.openTo) return [];
  const like = `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  return sql<PersonCard[]>`
    SELECT ${cardCols(viewerId)} FROM users u
    WHERE ${visibleToSql(viewerId)} AND u.id <> ${viewerId}
      ${term.length >= 2 ? sql`AND (u.nickname ILIKE ${like} OR u.full_name ILIKE ${like})` : sql``}
      ${filterSql(filters)}
    ORDER BY (lower(u.nickname) = lower(${term})) DESC, (u.nickname ILIKE ${`${term}%`}) DESC, u.last_seen_on DESC NULLS LAST, u.nickname
    LIMIT 20
  `;
}

/** A state's people, newest first, with optional filters (state pages). */
export async function getStatePeople(viewerId: string, state: string, filters: PeopleFilters, limit = 120): Promise<PersonCard[]> {
  return sql<PersonCard[]>`
    SELECT ${cardCols(viewerId)} FROM users u
    WHERE ${visibleToSql(viewerId)} AND u.state = ${state} ${filterSql({ ...filters, state: null })}
    ORDER BY u.completed_at DESC LIMIT ${limit}
  `;
}

async function loadPeopleLikeYou(viewerId: string): Promise<(PersonCard & { score: number; reason: string | null })[]> {
  return sql<(PersonCard & { score: number; reason: string | null })[]>`
    WITH me AS (SELECT school, course, state, interests FROM users WHERE id = ${viewerId}),
    scored AS (
      SELECT u.*,
             (CASE WHEN me.school IS NOT NULL AND lower(u.school) = lower(me.school) THEN 3 ELSE 0 END) AS s_school,
             (CASE WHEN me.course IS NOT NULL AND lower(u.course) = lower(me.course) THEN 2 ELSE 0 END) AS s_course,
             (CASE WHEN me.state IS NOT NULL AND u.state = me.state THEN 2 ELSE 0 END) AS s_state,
             (SELECT count(*) FROM unnest(u.interests) i WHERE lower(i) IN (SELECT lower(x) FROM unnest(me.interests) x))::int AS s_interests
      FROM users u, me
      WHERE ${visibleToSql(viewerId)} AND u.id <> ${viewerId}
        AND NOT EXISTS (SELECT 1 FROM follows WHERE follower_id = ${viewerId} AND following_id = u.id)
    )
    SELECT ${cardCols(viewerId)}, (s_school + s_course + s_state + s_interests)::int AS score,
           CASE WHEN s_school > 0 THEN 'Same school' WHEN s_course > 0 THEN 'Same course' WHEN s_interests > 0 THEN 'Shared interests'
                WHEN s_state > 0 THEN 'Same state' END AS reason
    FROM scored u
    WHERE (s_school + s_course + s_state + s_interests) > 0
    ORDER BY score DESC, u.last_seen_on DESC NULLS LAST, u.completed_at DESC
    LIMIT 12
  `;
}

/** "People like you": shared school, course, state and interests. Cached per user for 10 minutes. */
export const getPeopleLikeYou = (viewerId: string) =>
  unstable_cache(() => loadPeopleLikeYou(viewerId), ["people-like-you", viewerId], { revalidate: 600, tags: [`people-like-you:${viewerId}`] })();

/** School names already used, for suggestions (most common spelling of each). */
export const getSchoolSuggestions = unstable_cache(
  async () =>
    (
      await sql<{ school: string }[]>`
        SELECT DISTINCT ON (lower(school)) school FROM (
          SELECT school, count(*) OVER (PARTITION BY school) AS n FROM users WHERE school IS NOT NULL AND NOT is_banned
        ) s ORDER BY lower(school), n DESC LIMIT 500
      `
    ).map((r) => r.school),
  ["school-suggestions"],
  { revalidate: 3600, tags: ["schools"] },
);

/** The spelling already used for a school (case-insensitive), so "unilag" joins "UNILAG". */
export async function canonicalSchool(school: string) {
  const [r] = await sql<{ school: string }[]>`
    SELECT school FROM users WHERE lower(school) = lower(${school}) GROUP BY school ORDER BY count(*) DESC LIMIT 1
  `;
  return r?.school ?? school;
}

/** The viewer's blocked accounts (for unblocking in Settings). */
export async function getBlocked(viewerId: string) {
  return sql<{ id: string; nickname: string; photo_version: number }[]>`
    SELECT u.id, u.nickname, u.photo_version FROM blocks b JOIN users u ON u.id = b.blocked_id
    WHERE b.blocker_id = ${viewerId} ORDER BY b.created_at DESC
  `;
}

export { NOBODY };
