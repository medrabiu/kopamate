"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { validateNickname } from "@/lib/validate";
import { randomDigits } from "@/lib/util";

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
