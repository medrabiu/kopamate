"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { sql, transaction } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { track } from "@/lib/stats";
import { blockedSql, canonicalSchool } from "@/lib/social";
import {
  BIO_MAX,
  checkInterests,
  checkName,
  checkOpenTo,
  checkText,
  COURSE_MAX,
  FOLLOWS_PER_DAY,
  HI_COOLDOWN_DAYS,
  HI_FLAG_MAX_ACCEPT_RATE,
  HI_FLAG_MIN_IGNORED,
  HI_POLICIES,
  HIS_PENDING_MAX,
  HIS_PER_DAY,
  LINK_KINDS,
  NOTE_MAX,
  parseLink,
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  SCHOOL_MAX,
  type Links,
} from "@/lib/social-rules";

export type SocialResult = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function me() {
  const user = await getCurrentUser();
  return user?.completed_at && !user.is_banned ? user : null;
}

/** The other person exists, is finished, not banned, and neither has blocked the other. */
async function reachable(viewerId: string, targetId: string) {
  if (!UUID.test(targetId) || targetId === viewerId) return false;
  const [r] = await sql`
    SELECT 1 FROM users u WHERE u.id = ${targetId} AND u.completed_at IS NOT NULL AND NOT u.is_banned
      AND NOT ${blockedSql(viewerId, sql`u.id`)}
  `;
  return Boolean(r);
}

function refreshPeople(viewerId: string) {
  revalidateTag(`people-like-you:${viewerId}`);
  revalidatePath("/profile");
}

// ---------- Follow ----------

/** Follow or unfollow. At most 100 new follows a day; not possible when either has blocked the other. */
export async function follow(targetId: string, on: boolean): Promise<{ ok: true; followers: number } | { ok: false; error: string }> {
  const user = await me();
  if (!user) return { ok: false, error: "Log in to follow corpers." };
  if (on) {
    if (!(await reachable(user.id, targetId))) return { ok: false, error: "You can't follow this account." };
    const [{ n }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM follows WHERE follower_id = ${user.id} AND created_at > now() - interval '1 day'
    `;
    if (n >= FOLLOWS_PER_DAY) return { ok: false, error: "You've followed a lot of people today. Try again tomorrow." };
    const added = await sql`INSERT INTO follows (follower_id, following_id) VALUES (${user.id}, ${targetId}) ON CONFLICT DO NOTHING RETURNING 1`;
    if (added.length) await track("follow", user.id);
  } else if (UUID.test(targetId)) {
    const gone = await sql`DELETE FROM follows WHERE follower_id = ${user.id} AND following_id = ${targetId} RETURNING 1`;
    if (gone.length) await track("unfollow", user.id);
  }
  const [row] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM follows f JOIN users x ON x.id = f.follower_id WHERE f.following_id = ${targetId} AND NOT x.is_banned
  `;
  refreshPeople(user.id);
  return { ok: true, followers: row?.n ?? 0 };
}

// ---------- Say hi ----------

/**
 * Sends a "Say hi". Respects the other person's "Who can say hi to me", blocks, 10 a day, 30 pending at once,
 * and the 30-day wait after an ignored request (which the sender only ever sees as "Pending").
 */
export async function sayHi(targetId: string, rawNote: string): Promise<SocialResult> {
  const user = await me();
  if (!user) return { ok: false, error: "Log in first." };
  if (!(await reachable(user.id, targetId))) return { ok: false, error: "You can't say hi to this account." };
  const note = checkText(rawNote, "Note", NOTE_MAX);
  if (!note.ok) return note;

  const [t] = await sql<{ policy: string; follows_me: boolean; existing: string | null; from_them: boolean | null; daily: number; pending: number }[]>`
    SELECT u.hi_policy AS policy,
           EXISTS (SELECT 1 FROM follows WHERE follower_id = u.id AND following_id = ${user.id}) AS follows_me,
           (SELECT status FROM connections c
            WHERE ((c.from_id = ${user.id} AND c.to_id = u.id) OR (c.from_id = u.id AND c.to_id = ${user.id}))
              AND (c.status IN ('pending', 'accepted')
                   OR (c.status = 'declined' AND c.from_id = ${user.id} AND c.responded_at > now() - make_interval(days => ${HI_COOLDOWN_DAYS})))
            ORDER BY c.created_at DESC LIMIT 1) AS existing,
           EXISTS (SELECT 1 FROM connections c WHERE c.from_id = u.id AND c.to_id = ${user.id} AND c.status = 'pending') AS from_them,
           (SELECT count(*)::int FROM connections WHERE from_id = ${user.id} AND created_at > now() - interval '1 day') AS daily,
           (SELECT count(*)::int FROM connections WHERE from_id = ${user.id} AND status = 'pending') AS pending
    FROM users u WHERE u.id = ${targetId}
  `;
  if (t.policy === "nobody" || (t.policy === "following" && !t.follows_me)) return { ok: false, error: "This person isn't taking new hellos right now." };
  if (t.existing === "accepted") return { ok: false, error: "You're already connected." };
  if (t.from_them) return { ok: false, error: "They already said hi to you. Answer it in Notifications." };
  // Pending either way, or ignored recently: shown as pending, never as declined.
  if (t.existing) return { ok: true };
  if (t.daily >= HIS_PER_DAY) return { ok: false, error: `You can say hi to ${HIS_PER_DAY} people a day. Try again tomorrow.` };
  if (t.pending >= HIS_PENDING_MAX) return { ok: false, error: "You have a lot of hellos waiting for a reply. Wait for some answers first." };

  try {
    const [c] = await sql<{ id: number }[]>`
      INSERT INTO connections (from_id, to_id, note) VALUES (${user.id}, ${targetId}, ${note.value}) RETURNING id
    `;
    await sql`
      INSERT INTO notifications (user_id, kind, title, body, actor_id, data)
      VALUES (${targetId}, 'hi_request', ${`${user.nickname} said hi`}, ${note.value}, ${user.id}, ${sql.json({ connection: c.id })})
    `;
  } catch (err) {
    // Two taps at once: one pending request per pair (unique index). Already sent.
    if ((err as { code?: string }).code === "23505") return { ok: true };
    throw err;
  }
  await track("hi_sent", user.id);
  revalidatePath(`/u/@${user.nickname}`);
  return { ok: true };
}

/**
 * Accept or ignore a "Say hi" sent to you. Accepting shares both WhatsApp numbers (the screen says so before
 * this runs). Ignoring stays invisible to the sender. Senders who are ignored a lot are flagged for review.
 */
export async function respondHi(connectionId: number, accept: boolean): Promise<SocialResult> {
  const user = await me();
  if (!user) return { ok: false, error: "Log in first." };
  const [c] = await sql<{ from_id: string }[]>`
    UPDATE connections SET status = ${accept ? "accepted" : "declined"}, responded_at = now()
    WHERE id = ${connectionId} AND to_id = ${user.id} AND status = 'pending'
      AND NOT ${blockedSql(user.id, sql`from_id`)}
    RETURNING from_id
  `;
  if (!c) return { ok: false, error: "This request isn't waiting any more." };
  if (accept) {
    await sql`
      INSERT INTO notifications (user_id, kind, title, body, actor_id, data)
      VALUES (${c.from_id}, 'hi_accepted', ${`${user.nickname} said hi back`}, 'You can chat on WhatsApp now.', ${user.id},
              ${sql.json({ connection: connectionId })})
    `;
    await track("hi_accepted", user.id);
  } else {
    const [s] = await sql<{ ignored: number; accepted: number }[]>`
      SELECT count(*) FILTER (WHERE status = 'declined')::int AS ignored, count(*) FILTER (WHERE status = 'accepted')::int AS accepted
      FROM connections WHERE from_id = ${c.from_id}
    `;
    if (s.ignored >= HI_FLAG_MIN_IGNORED && s.accepted / (s.ignored + s.accepted) < HI_FLAG_MAX_ACCEPT_RATE) {
      await sql`UPDATE users SET is_flagged = true WHERE id = ${c.from_id} AND NOT is_flagged`;
      await track("admin_action", null, { admin: "system", action: "auto_flag_hi", target: c.from_id });
    }
  }
  revalidatePath("/notifications");
  return { ok: true };
}

/** Ends an accepted connection: the WhatsApp button disappears for both. */
export async function removeConnection(otherId: string): Promise<SocialResult> {
  const user = await me();
  if (!user || !UUID.test(otherId)) return { ok: false, error: "Log in first." };
  await sql`
    UPDATE connections SET status = 'removed', responded_at = now()
    WHERE status = 'accepted' AND ((from_id = ${user.id} AND to_id = ${otherId}) OR (from_id = ${otherId} AND to_id = ${user.id}))
  `;
  return { ok: true };
}

// ---------- Block and report ----------

/** Blocks someone: removes follows both ways, ends any "Say hi", hides each from the other everywhere. */
export async function block(targetId: string): Promise<SocialResult> {
  const user = await me();
  if (!user || !UUID.test(targetId) || targetId === user.id) return { ok: false, error: "You can't block this account." };
  await transaction(async (tx) => {
    await tx`INSERT INTO blocks (blocker_id, blocked_id) VALUES (${user.id}, ${targetId}) ON CONFLICT DO NOTHING`;
    await tx`DELETE FROM follows WHERE (follower_id = ${user.id} AND following_id = ${targetId}) OR (follower_id = ${targetId} AND following_id = ${user.id})`;
    await tx`
      UPDATE connections SET status = 'removed', responded_at = now()
      WHERE status IN ('pending', 'accepted') AND ((from_id = ${user.id} AND to_id = ${targetId}) OR (from_id = ${targetId} AND to_id = ${user.id}))
    `;
  });
  refreshPeople(user.id);
  revalidateTag(`people-like-you:${targetId}`);
  return { ok: true };
}

export async function unblock(targetId: string): Promise<SocialResult> {
  const user = await me();
  if (!user || !UUID.test(targetId)) return { ok: false, error: "Log in first." };
  await sql`DELETE FROM blocks WHERE blocker_id = ${user.id} AND blocked_id = ${targetId}`;
  refreshPeople(user.id);
  revalidatePath("/profile/settings");
  return { ok: true };
}

/** Reports someone to the team. One open report per person you report. */
export async function report(targetId: string, reason: string, rawNote: string): Promise<SocialResult> {
  const user = await me();
  if (!user || !UUID.test(targetId) || targetId === user.id) return { ok: false, error: "You can't report this account." };
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) return { ok: false, error: "Choose a reason." };
  const note = checkText(rawNote, "Note", REPORT_NOTE_MAX, true);
  if (!note.ok) return note;
  await sql`
    INSERT INTO reports (reporter_id, target_id, reason, note) VALUES (${user.id}, ${targetId}, ${reason}, ${note.value})
    ON CONFLICT (reporter_id, target_id) WHERE status = 'open' DO NOTHING
  `;
  return { ok: true };
}

// ---------- About you ----------

export type AboutState = { ok?: boolean; error?: string } | undefined;

/** Bio, school, course, interests, "Open to" and links, all optional, checked and stored as plain text. */
export async function saveAbout(_prev: AboutState, fd: FormData): Promise<AboutState> {
  const user = await me();
  if (!user) return { error: "Log in first." };
  const bio = checkText(String(fd.get("bio") ?? ""), "Bio", BIO_MAX);
  if (!bio.ok) return { error: bio.error };
  const school = checkName(String(fd.get("school") ?? ""), "School", SCHOOL_MAX);
  if (!school.ok) return { error: school.error };
  const course = checkName(String(fd.get("course") ?? ""), "Course", COURSE_MAX);
  if (!course.ok) return { error: course.error };
  const interests = checkInterests(fd.getAll("interests").map(String));
  if (!interests.ok) return { error: interests.error };
  const openTo = checkOpenTo(fd.getAll("open_to").map(String));
  const links: Links = {};
  for (const k of LINK_KINDS) {
    const l = parseLink(k, String(fd.get(`link_${k}`) ?? ""));
    if (!l.ok) return { error: l.error };
    if (l.value) links[k] = l.value;
  }
  const schoolName = school.value ? await canonicalSchool(school.value) : null;
  await sql`
    UPDATE users SET bio = ${bio.value}, school = ${schoolName}, course = ${course.value},
      school_set_at = CASE WHEN ${schoolName}::text IS NOT NULL THEN COALESCE(school_set_at, now()) ELSE school_set_at END,
      interests = ${interests.value}, open_to = ${openTo}, links = ${sql.json(links)}
    WHERE id = ${user.id}
  `;
  await track("profile_edit", user.id);
  revalidateTag("schools");
  refreshPeople(user.id);
  revalidatePath("/home");
  revalidatePath(`/u/@${user.nickname}`);
  return { ok: true };
}

export async function setHiPolicy(policy: string): Promise<SocialResult> {
  const user = await me();
  if (!user) return { ok: false, error: "Log in first." };
  if (!(HI_POLICIES as readonly string[]).includes(policy)) return { ok: false, error: "Choose an option." };
  await sql`UPDATE users SET hi_policy = ${policy} WHERE id = ${user.id}`;
  revalidatePath("/profile/settings");
  return { ok: true };
}

/** Hides the profile-strength card on Home for 7 days. */
export async function dismissStrength(): Promise<SocialResult> {
  const user = await me();
  if (!user) return { ok: false, error: "Log in first." };
  await sql`UPDATE users SET strength_dismissed_at = now() WHERE id = ${user.id}`;
  revalidatePath("/home");
  return { ok: true };
}
