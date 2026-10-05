import "server-only";
import { randomBytes } from "crypto";
import { sql } from "./db";
import { sendPush } from "./push";
import { nextStep, poolFor, prizeAmounts, type Platform, type Prize } from "./challenge-rules";

/**
 * Challenges (see db/schema.sql). Users see the brief, rules, prizes and their own entries only; the team
 * picks winners offline from the admin lists. Pure rules (pool, links, handles) live in lib/challenge-rules.ts,
 * sign-up attribution in lib/challenge-signups.ts.
 */

export type ChallengeStatus = "draft" | "upcoming" | "open" | "closed" | "results";

export type Challenge = {
  id: number;
  slug: string;
  title: string;
  badge_name: string;
  brief: string;
  ideas: string;
  rules: string;
  hashtag: string | null;
  required_tags: Partial<Record<Platform, string>>;
  social_links: Partial<Record<Platform | "whatsapp", string>>;
  max_entries_per_user: number;
  opens_at: Date | null;
  closes_at: Date | null;
  verify_by: Date | null;
  /** Whether entrants are asked for post stats (views, likes, a screenshot). */
  ask_for_stats: boolean;
  metrics_due_hours: number;
  pool_base: number;
  pool_step_entries: number;
  pool_step_amount: number;
  pool_cap: number;
  prize_split: Prize[];
  status: ChallengeStatus;
  published_at: Date | null;
  created_at: Date;
};

export type Participant = {
  x_handle: string | null;
  tiktok_handle: string | null;
  instagram_handle: string | null;
  confirmed_follow_x: boolean;
  confirmed_follow_other: boolean;
  confirmed_whatsapp_channel: boolean;
};

export type EntryStatus = "pending" | "approved" | "rejected" | "disqualified";

export type MyEntry = {
  id: number;
  platform: Platform;
  post_url: string;
  format: string;
  caption_note: string | null;
  entry_code: string;
  submitted_at: Date;
  status: EntryStatus;
  reject_reason: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  metrics_submitted_at: Date | null;
  joined: number;
};

/** Statuses users can see (draft is admin only). */
export const PUBLIC_STATUSES: ChallengeStatus[] = ["upcoming", "open", "closed", "results"];

/** The text fields hold one item per line. */
export const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export async function getChallenge(slug: string, includeDraft = false): Promise<Challenge | null> {
  const [c] = await sql<Challenge[]>`SELECT * FROM challenges WHERE slug = ${slug}`;
  if (!c || (!includeDraft && c.status === "draft")) return null;
  return c;
}

export async function getChallengeById(id: number): Promise<Challenge | null> {
  const [c] = await sql<Challenge[]>`SELECT * FROM challenges WHERE id = ${id}`;
  return c ?? null;
}

/** Challenges users can see, newest first. */
export async function listChallenges(): Promise<Challenge[]> {
  return sql<Challenge[]>`
    SELECT * FROM challenges WHERE status IN ${sql(PUBLIC_STATUSES)}
    ORDER BY (status IN ('open', 'upcoming')) DESC, COALESCE(opens_at, created_at) DESC
  `;
}

/** The challenge for the Home banner: open first, then upcoming. */
export async function getBannerChallenge(): Promise<Challenge | null> {
  const [c] = await sql<Challenge[]>`
    SELECT * FROM challenges WHERE status IN ('open', 'upcoming')
    ORDER BY status = 'open' DESC, opens_at NULLS LAST LIMIT 1
  `;
  return c ?? null;
}

/** Live pool: only approved entries make it grow. */
export async function getPool(c: Challenge) {
  const [row] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM challenge_entries WHERE challenge_id = ${c.id} AND status = 'approved'
  `;
  const approved = row?.n ?? 0;
  const pool = poolFor(c, approved);
  return { approved, pool, next: nextStep(c, approved), prizes: prizeAmounts(pool, c.prize_split) };
}

/** Whether people can enter now: status open and inside the dates. */
export function isOpen(c: Challenge, now = Date.now()) {
  return c.status === "open" && !!c.opens_at && !!c.closes_at && c.opens_at.getTime() <= now && c.closes_at.getTime() > now;
}

export async function getParticipant(challengeId: number, userId: string): Promise<Participant | null> {
  const [p] = await sql<Participant[]>`
    SELECT x_handle, tiktok_handle, instagram_handle, confirmed_follow_x, confirmed_follow_other, confirmed_whatsapp_channel
    FROM challenge_participants WHERE challenge_id = ${challengeId} AND user_id = ${userId}
  `;
  return p ?? null;
}

/** The user's own entries, with how many people joined through each entry's link (voided ones left out). */
export async function getMyEntries(challengeId: number, userId: string): Promise<MyEntry[]> {
  return sql<MyEntry[]>`
    SELECT e.id, e.platform, e.post_url, e.format, e.caption_note, e.entry_code, e.submitted_at, e.status, e.reject_reason,
           e.views, e.likes, e.comments, e.shares, e.metrics_submitted_at,
           (SELECT count(*) FROM challenge_signups s WHERE s.entry_id = e.id AND s.void_reason IS NULL)::int AS joined
    FROM challenge_entries e
    WHERE e.challenge_id = ${challengeId} AND e.user_id = ${userId}
    ORDER BY e.submitted_at
  `;
}

/** Entries that use up one of the user's places (rejected ones don't, so they can try again). */
export const countsTowardLimit = (e: { status: EntryStatus }) => e.status !== "rejected";

/** Post stats (when the challenge asks for them) can be added from metrics_due_hours after submitting until winners are published. */
export function metricsOpen(c: Challenge, e: { submitted_at: Date; status: EntryStatus }, now = Date.now()) {
  return c.ask_for_stats && !c.published_at && e.status !== "rejected" && e.status !== "disqualified" && now >= e.submitted_at.getTime() + c.metrics_due_hours * 3_600_000;
}

/** Winners as shown on the challenge page once published: names and prizes only. */
export async function getPublicWinners(challengeId: number) {
  return sql<{ prize_key: string; amount_ngn: number; user_id: string; nickname: string; photo_version: number; state: string | null }[]>`
    SELECT w.prize_key, w.amount_ngn, u.id AS user_id, u.nickname, u.photo_version, u.state
    FROM challenge_winners w JOIN users u ON u.id = w.user_id
    JOIN challenges c ON c.id = w.challenge_id
    WHERE w.challenge_id = ${challengeId} AND c.published_at IS NOT NULL
  `;
}

const CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

/** A short code for an entry link (/c/<code>), unique across entries. */
export async function newEntryCode() {
  for (let i = 0; i < 10; i++) {
    const bytes = randomBytes(7);
    const code = Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
    const [taken] = await sql`SELECT 1 FROM challenge_entries WHERE entry_code = ${code}`;
    if (!taken) return code;
  }
  throw new Error("Could not make an entry code");
}

/** An in-app notification and a push, for one user. Never throws. */
export async function notifyUser(userId: string, title: string, body: string, url: string, tag = "challenge") {
  try {
    await sql`INSERT INTO notifications (user_id, kind, title, body, url) VALUES (${userId}, 'challenge', ${title}, ${body}, ${url})`;
    await sendPush(userId, { title, body, url, tag });
  } catch (err) {
    console.error("challenge notification failed", err);
  }
}

/** Audit log of admin actions. */
export async function logChallenge(challengeId: number, actor: string | null, action: string, detail?: Record<string, unknown>) {
  await sql`
    INSERT INTO challenge_events (challenge_id, actor, action, detail)
    VALUES (${challengeId}, ${actor}, ${action}, ${detail ? sql.json(detail as never) : null})
  `;
}

/** Per-challenge badge slugs (the badges are created when a challenge is saved in admin). */
export const entrantBadge = (c: { id: number }) => `challenge_${c.id}_entrant`;
export const winnerBadge = (c: { id: number }) => `challenge_${c.id}_winner`;

/** Makes sure the challenge's Entrant and Winner badges exist, with its current name. */
export async function ensureChallengeBadges(c: { id: number; badge_name: string }) {
  await sql`
    INSERT INTO badges (slug, name, description, icon, color, priority, kind, qualifies_for_rewards) VALUES
      (${entrantBadge(c)}, ${`${c.badge_name} · Entrant`}, ${`Had an entry approved in ${c.badge_name}`}, 'flame', 'violet', 25, 'manual', false),
      (${winnerBadge(c)}, ${`${c.badge_name} · Winner`}, ${`Won a prize in ${c.badge_name}`}, 'trophy', 'amber', 80, 'manual', false)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
  `;
}
