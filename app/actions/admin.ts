"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { normalizeStateCode, validateUsername } from "@/lib/validate";
import { isState } from "@/lib/states";
import { randomDigits } from "@/lib/util";
import { isUniqueViolation, isUsernameViolation } from "@/lib/signup";
import { awardBadge, checkAutoBadges, restoreBadge, revokeBadge } from "@/lib/badges";
import { getLeaderboardClose, track } from "@/lib/stats";
import { dropBonus, recordBonuses } from "@/lib/referral-bonus";

function id(fd: FormData) {
  const v = String(fd.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(v)) throw new Error("Bad id");
  return v;
}

function done() {
  revalidateTag("stats");
  revalidatePath("/admin", "layout");
}

/** Admin edit of a user's username, state and state code. Invalid values (and taken usernames) are ignored. */
export async function adminUpdateUser(fd: FormData) {
  await requireAdmin();
  const userId = id(fd);
  const nick = validateUsername(String(fd.get("nickname") ?? ""));
  const state = String(fd.get("state") ?? "");
  const code = normalizeStateCode(String(fd.get("state_code") ?? ""));
  if (nick.ok) await setUsername(userId, nick.value);
  if (state === "" || isState(state)) await sql`UPDATE users SET state = ${state || null} WHERE id = ${userId}`;
  if (code !== null) {
    try {
      await sql`UPDATE users SET state_code = ${code || null} WHERE id = ${userId}`;
    } catch (err) {
      // Another account is already verified with this state code; keep the old one.
      if (!isUniqueViolation(err)) throw err;
    }
  }
  done();
}

/** Permanently deletes an account (not your own). Needs "DELETE" typed to confirm. */
export async function adminDeleteUser(fd: FormData) {
  const admin = await requireAdmin();
  const userId = id(fd);
  if (userId === admin.id || String(fd.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return;
  await sql`DELETE FROM users WHERE id = ${userId}`;
  done();
  redirect("/admin/users");
}

export async function setFlag(fd: FormData) {
  await requireAdmin();
  const on = fd.get("on") === "1";
  await sql`UPDATE users SET is_flagged = ${on} WHERE id = ${id(fd)}`;
  done();
}

/** The gold brand check or the Kopamate team logo next to someone's name (logged as an admin action). */
export async function setNameBadge(fd: FormData) {
  const admin = await requireAdmin();
  const userId = id(fd);
  const badge = String(fd.get("badge"));
  const on = fd.get("on") === "1";
  if (badge === "brand") await sql`UPDATE users SET is_brand = ${on} WHERE id = ${userId}`;
  else if (badge === "team") await sql`UPDATE users SET is_team = ${on} WHERE id = ${userId}`;
  else return;
  await track("admin_action", null, { admin: admin.id, action: `${on ? "give" : "remove"}_${badge}_badge`, target: userId });
  done();
  revalidatePath("/", "layout");
}

export async function setBan(fd: FormData) {
  const admin = await requireAdmin();
  const userId = id(fd);
  if (userId === admin.id) return;
  const on = fd.get("on") === "1";
  await sql`UPDATE users SET is_banned = ${on} WHERE id = ${userId}`;
  if (on) await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
  done();
}

export async function renameUser(fd: FormData) {
  await requireAdmin();
  const nick = validateUsername(String(fd.get("nickname") ?? ""));
  if (!nick.ok) return;
  await setUsername(id(fd), nick.value);
  done();
}

/** Sets a username unless someone else has it (then nothing changes). */
async function setUsername(userId: string, username: string) {
  try {
    await sql`UPDATE users SET nickname = ${username} WHERE id = ${userId}`;
  } catch (err) {
    if (!isUsernameViolation(err)) throw err;
  }
}

export async function adminRemovePhoto(fd: FormData) {
  await requireAdmin();
  await sql`
    UPDATE users SET photo_data = NULL, photo_mime = NULL, photo_thumb_data = NULL, photo_thumb_mime = NULL, photo_version = 0
    WHERE id = ${id(fd)}
  `;
  done();
}

export async function saveSettings(fd: FormData) {
  await requireAdmin();
  const mode = fd.get("first_n_mode") === "signup" ? "signup" : "position";
  await sql`
    INSERT INTO settings (key, value) VALUES ('first_n_mode', ${mode})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  revalidateTag("settings");
  revalidatePath("/", "layout");
}

/** Approves a verification request. The ID card photo is deleted once a decision is made. */
/** Records a verification decision for the history admins see on the review screen. */
async function logVerification(userId: string, action: string, actor: string, note: string | null = null) {
  await sql`
    INSERT INTO verification_events (user_id, action, state_code, note, actor)
    SELECT id, ${action}, state_code, ${note}, ${actor} FROM users WHERE id = ${userId}
  `;
}

export async function approveVerification(fd: FormData) {
  const admin = await requireAdmin();
  const userId = id(fd);
  try {
    await sql`
      UPDATE users SET verification_status = 'verified', verified_at = now(), verification_note = NULL,
        id_card_data = NULL, id_card_mime = NULL
      WHERE id = ${userId} AND verification_status = 'pending'
    `;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    await rejectWith(userId, "This state code is already verified on another account.");
  }
  const [row] = await sql<{ verification_status: string }[]>`SELECT verification_status FROM users WHERE id = ${userId}`;
  await logVerification(userId, row?.verification_status === "verified" ? "approved" : "rejected", admin.id,
    row?.verification_status === "verified" ? null : "State code already verified on another account");
  // Whoever invited them earns their referral bonus now.
  await recordBonuses({ referredId: userId });
  done();
}

export async function rejectVerification(fd: FormData) {
  const admin = await requireAdmin();
  const userId = id(fd);
  const note = String(fd.get("note") ?? "").trim().slice(0, 200) || "We couldn't confirm your ID card. Please try again with a clear photo.";
  // "Fake state code": no account can use it again.
  if (fd.get("block_code") === "1") {
    await sql`
      INSERT INTO blocked_state_codes (code, reason, blocked_by)
      SELECT state_code, ${note}, ${admin.id} FROM users WHERE id = ${userId} AND state_code IS NOT NULL
      ON CONFLICT (code) DO NOTHING
    `;
  }
  await rejectWith(userId, note);
  await logVerification(userId, fd.get("block_code") === "1" ? "rejected_blocked" : "rejected", admin.id, note);
  done();
}

/** Gives someone who used up their tries (or is waiting after a rejection) another go right away. */
export async function allowVerificationRetry(fd: FormData) {
  const admin = await requireAdmin();
  const userId = id(fd);
  await sql`UPDATE users SET verification_attempts = 0, verification_rejected_at = NULL WHERE id = ${userId}`;
  await logVerification(userId, "reset", admin.id);
  done();
}

/** Lets a blocked state code be used again (e.g. it was blocked by mistake). */
export async function unblockStateCode(fd: FormData) {
  await requireAdmin();
  const code = String(fd.get("code") ?? "").trim().toUpperCase().slice(0, 20);
  if (code) await sql`DELETE FROM blocked_state_codes WHERE code = ${code}`;
  done();
}

async function rejectWith(userId: string, note: string) {
  await sql`
    UPDATE users SET verification_status = 'rejected', verification_note = ${note}, verification_rejected_at = now(),
      id_card_data = NULL, id_card_mime = NULL
    WHERE id = ${userId} AND verification_status = 'pending'
  `;
}

/** Removes someone's verified status (e.g. it turned out to be fake). */
export async function revokeVerification(fd: FormData) {
  const admin = await requireAdmin();
  await sql`
    UPDATE users SET verification_status = 'rejected', verified_at = NULL,
      verification_note = 'Your verification was removed. Contact us on WhatsApp if you think this is a mistake.'
    WHERE id = ${id(fd)} AND verification_status = 'verified'
  `;
  await dropBonus(id(fd));
  await logVerification(id(fd), "revoked", admin.id);
  done();
}

/** Sets a temporary 4-digit PIN (for people who forgot theirs) and shows it once on the admin page. */
export async function resetPin(fd: FormData) {
  await requireAdmin();
  const userId = id(fd);
  const pin = randomDigits(4);
  const rows = await sql<{ nickname: string }[]>`
    UPDATE users SET pin_hash = ${await bcrypt.hash(pin, 10)}, failed_pin_attempts = 0, pin_locked_until = NULL
    WHERE id = ${userId} RETURNING nickname
  `;
  if (!rows[0]) return;
  redirect(`/admin/users/${userId}?pin=${pin}`);
}

/** ISO 8601 with a time zone, e.g. 2026-10-02T23:59:59+01:00. */
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Early Corper deadline, leaderboard close and the mystery prize text. */
export async function saveRewardSettings(fd: FormData) {
  await requireAdmin();
  const early = String(fd.get("early_deadline") ?? "").trim();
  const close = String(fd.get("leaderboard_close") ?? "").trim();
  const reveal = String(fd.get("rewards_reveal_text") ?? "").trim().slice(0, 200);
  for (const v of [early, close]) {
    if (!ISO_TIME.test(v) || Number.isNaN(Date.parse(v))) redirect("/admin/settings?error=date");
  }
  if (Date.parse(close) <= Date.parse(early)) redirect("/admin/settings?error=order");
  const values: [string, string][] = [
    ["early_deadline", early],
    ["leaderboard_close", close],
  ];
  if (reveal) values.push(["rewards_reveal_text", reveal]);
  for (const [key, value] of values) {
    await sql`
      INSERT INTO settings (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
  }
  revalidateTag("settings");
  revalidatePath("/", "layout");
  redirect("/admin/settings?saved=1");
}

function badgesDone() {
  // Leaderboards and lists carry badges and are cached under "stats".
  revalidateTag("stats");
  revalidatePath("/", "layout");
}

/** Runs the auto-badge check for every completed user. Safe to run again. */
export async function runBadgeBackfill() {
  await requireAdmin();
  const added = await checkAutoBadges("all");
  badgesDone();
  redirect(`/admin/badges?backfill=${added.length}`);
}

/**
 * After the leaderboard closes: Prophet goes to everyone who picked the state with the most completed
 * sign-ups right now (every state tied for first counts).
 */
export async function awardProphets() {
  const admin = await requireAdmin();
  if (Date.now() < new Date(await getLeaderboardClose()).getTime()) redirect("/admin/badges?prophet=early");
  const rows = await sql<{ user_id: string }[]>`
    WITH counts AS (
      SELECT state, count(*) AS n FROM users
      WHERE completed_at IS NOT NULL AND NOT is_banned AND state IS NOT NULL
      GROUP BY state
    ),
    winners AS (SELECT state FROM counts WHERE n = (SELECT max(n) FROM counts))
    INSERT INTO user_badges (user_id, badge_slug, awarded_by)
    SELECT p.user_id, 'prophet', ${admin.id}
    FROM state_predictions p JOIN users u ON u.id = p.user_id
    WHERE p.state IN (SELECT state FROM winners) AND NOT u.is_banned AND NOT u.is_flagged
    ON CONFLICT (user_id, badge_slug) DO NOTHING
    RETURNING user_id
  `;
  badgesDone();
  redirect(`/admin/badges?prophet=${rows.length}`);
}

function slugOf(fd: FormData) {
  const v = String(fd.get("slug") ?? "");
  if (!/^[a-z_]{1,40}$/.test(v)) throw new Error("Bad badge");
  return v;
}

/** Gives a manual badge (Prophet, State Ambassador). Auto badges are given by the system only. */
export async function adminAwardBadge(fd: FormData) {
  const admin = await requireAdmin();
  const userId = id(fd);
  const slug = slugOf(fd);
  const [badge] = await sql<{ kind: string }[]>`SELECT kind FROM badges WHERE slug = ${slug}`;
  if (badge?.kind !== "manual") return;
  await awardBadge(userId, slug, admin.id);
  badgesDone();
}

export async function adminRevokeBadge(fd: FormData) {
  await requireAdmin();
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 200) || "Removed by an admin";
  await revokeBadge(id(fd), slugOf(fd), reason);
  badgesDone();
}

export async function adminRestoreBadge(fd: FormData) {
  await requireAdmin();
  await restoreBadge(id(fd), slugOf(fd));
  badgesDone();
}
