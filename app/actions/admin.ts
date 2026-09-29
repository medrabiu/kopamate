"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { validateNickname } from "@/lib/validate";
import { randomDigits } from "@/lib/util";
import { isUniqueViolation } from "@/lib/signup";

function id(fd: FormData) {
  const v = String(fd.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(v)) throw new Error("Bad id");
  return v;
}

function done() {
  revalidateTag("stats");
  revalidatePath("/admin");
}

export async function setFlag(fd: FormData) {
  await requireAdmin();
  const on = fd.get("on") === "1";
  await sql`UPDATE users SET is_flagged = ${on} WHERE id = ${id(fd)}`;
  done();
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
  const nick = validateNickname(String(fd.get("nickname") ?? ""));
  if (!nick.ok) return;
  await sql`UPDATE users SET nickname = ${nick.value} WHERE id = ${id(fd)}`;
  done();
}

export async function adminRemovePhoto(fd: FormData) {
  await requireAdmin();
  await sql`UPDATE users SET photo_data = NULL, photo_mime = NULL, photo_version = 0 WHERE id = ${id(fd)}`;
  done();
}

export async function addReward(fd: FormData) {
  await requireAdmin();
  const title = String(fd.get("title") ?? "").trim().slice(0, 80);
  const description = String(fd.get("description") ?? "").trim().slice(0, 200) || null;
  if (!title) return;
  await sql`INSERT INTO rewards (user_id, title, description) VALUES (${id(fd)}, ${title}, ${description})`;
  done();
}

export async function markRewardSent(fd: FormData) {
  await requireAdmin();
  await sql`UPDATE rewards SET status = 'sent', sent_at = now() WHERE id = ${id(fd)}`;
  done();
}

export async function saveSettings(fd: FormData) {
  await requireAdmin();
  const prize = String(fd.get("prize_teaser_text") ?? "").trim().slice(0, 300);
  const mode = fd.get("first_n_mode") === "signup" ? "signup" : "position";
  if (prize) {
    await sql`
      INSERT INTO settings (key, value) VALUES ('prize_teaser_text', ${prize})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
  }
  await sql`
    INSERT INTO settings (key, value) VALUES ('first_n_mode', ${mode})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  revalidateTag("settings");
  revalidatePath("/", "layout");
}

/** Approves a verification request. The ID card photo is deleted once a decision is made. */
export async function approveVerification(fd: FormData) {
  await requireAdmin();
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
  done();
}

export async function rejectVerification(fd: FormData) {
  await requireAdmin();
  const note = String(fd.get("note") ?? "").trim().slice(0, 200) || "We couldn't confirm your ID card. Please try again with a clear photo.";
  await rejectWith(id(fd), note);
  done();
}

async function rejectWith(userId: string, note: string) {
  await sql`
    UPDATE users SET verification_status = 'rejected', verification_note = ${note}, id_card_data = NULL, id_card_mime = NULL
    WHERE id = ${userId} AND verification_status = 'pending'
  `;
}

/** Removes someone's verified status (e.g. it turned out to be fake). */
export async function revokeVerification(fd: FormData) {
  await requireAdmin();
  await sql`
    UPDATE users SET verification_status = 'rejected', verified_at = NULL,
      verification_note = 'Your verification was removed. Contact us on WhatsApp if you think this is a mistake.'
    WHERE id = ${id(fd)} AND verification_status = 'verified'
  `;
  done();
}

/** Home announcement slide. Links must be in-app ("/…") or https. */
export async function saveAnnouncement(fd: FormData) {
  await requireAdmin();
  const text = (name: string, max: number) => String(fd.get(name) ?? "").trim().slice(0, max);
  let url = text("announcement_button_url", 300);
  if (url && !(url.startsWith("/") && !url.startsWith("//")) && !url.startsWith("https://")) url = "";
  const values: [string, string][] = [
    ["announcement_active", fd.get("announcement_active") === "1" ? "1" : "0"],
    ["announcement_title", text("announcement_title", 60)],
    ["announcement_body", text("announcement_body", 200)],
    ["announcement_button_label", text("announcement_button_label", 24)],
    ["announcement_button_url", url],
  ];
  for (const [key, value] of values) {
    await sql`
      INSERT INTO settings (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
  }
  revalidateTag("settings");
  revalidatePath("/home");
  revalidatePath("/admin");
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
  redirect(`/admin?reset=${encodeURIComponent(rows[0].nickname)}&pin=${pin}`);
}
