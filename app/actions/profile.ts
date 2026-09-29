"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { sql } from "@/lib/db";
import { destroySession, getCurrentUser } from "@/lib/session";
import { normalizeNigerianPhone, normalizeStateCode, validateNickname, validatePin } from "@/lib/validate";
import { isState } from "@/lib/states";
import { isUniqueViolation, whatsappTaken } from "@/lib/signup";
import { STATE_CHANGE_DAYS } from "@/lib/config";

export type ProfileState = { error?: string; ok?: boolean } | undefined;

async function me() {
  const user = await getCurrentUser();
  if (!user || !user.completed_at) redirect("/login");
  return user;
}

export async function updateField(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await me();
  const field = String(fd.get("field") ?? "");
  // Phone and state inputs keep their own names; the others post "value".
  const value = String(fd.get(field === "whatsapp" || field === "state" ? field : "value") ?? "");

  switch (field) {
    case "nickname": {
      const nick = validateNickname(value);
      if (!nick.ok) return { error: nick.error };
      await sql`UPDATE users SET nickname = ${nick.value} WHERE id = ${user.id}`;
      break;
    }
    case "whatsapp": {
      const phone = normalizeNigerianPhone(value);
      if (!phone) return { error: "Enter a valid Nigerian WhatsApp number." };
      if (phone === user.whatsapp_e164) break;
      if (await whatsappTaken(phone, user.id)) return { error: "This number is used by another account." };
      try {
        await sql`UPDATE users SET whatsapp_e164 = ${phone} WHERE id = ${user.id}`;
      } catch (err) {
        if (isUniqueViolation(err)) return { error: "This number is used by another account." };
        throw err;
      }
      break;
    }
    case "state": {
      if (!isState(value)) return { error: "Choose a state." };
      if (value === user.state) break;
      if (user.state_changed_at) {
        const next = new Date(new Date(user.state_changed_at).getTime() + STATE_CHANGE_DAYS * 86400_000);
        if (next > new Date()) {
          return { error: `You can change your state again on ${next.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.` };
        }
      }
      await sql`UPDATE users SET state = ${value}, state_changed_at = now() WHERE id = ${user.id}`;
      revalidateTag("stats");
      break;
    }
    case "state_code": {
      if (user.verification_status === "verified" || user.verification_status === "pending") {
        return { error: "Your state code is locked while it's being checked or once you're verified." };
      }
      const code = normalizeStateCode(value);
      if (code === null) return { error: "State codes look like EN/26B/1234." };
      await sql`UPDATE users SET state_code = ${code || null} WHERE id = ${user.id}`;
      break;
    }
    default:
      return { error: "Something went wrong. Try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleShowInList() {
  const user = await me();
  await sql`UPDATE users SET show_in_list = NOT show_in_list WHERE id = ${user.id}`;
  revalidatePath("/", "layout");
}

export async function changePin(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await me();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (!validatePin(next)) return { error: "Your new PIN must be 4 digits." };
  const [row] = await sql<{ pin_hash: string | null }[]>`SELECT pin_hash FROM users WHERE id = ${user.id}`;
  if (row?.pin_hash && !(await bcrypt.compare(current, row.pin_hash))) return { error: "Your current PIN is wrong." };
  await sql`UPDATE users SET pin_hash = ${await bcrypt.hash(next, 10)} WHERE id = ${user.id}`;
  return { ok: true };
}

const MAX_PHOTO_BYTES = 300 * 1024;

function sniffImage(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}

/** The phone resizes the photo (max 400×400) before upload, which also strips metadata. */
export async function uploadPhoto(fd: FormData): Promise<ProfileState> {
  const user = await me();
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "That photo is too large. Try another." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImage(bytes);
  if (!mime) return { error: "Use a JPG, PNG or WebP photo." };
  const b64 = Buffer.from(bytes).toString("base64");
  await sql`
    UPDATE users SET photo_data = ${b64}, photo_mime = ${mime}, photo_version = photo_version + 1
    WHERE id = ${user.id}
  `;
  revalidatePath("/", "layout");
  return { ok: true };
}

const MAX_ID_CARD_BYTES = 900 * 1024;

/** Sends the state code and an ID card photo for an admin to check. The phone resizes the photo first. */
export async function requestVerification(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await me();
  if (user.verification_status === "verified") return { ok: true };
  const code = normalizeStateCode(String(fd.get("state_code") ?? ""));
  if (!code) return { error: "Enter your state code, like EN/26B/1234." };
  const file = fd.get("id_card");
  if (!(file instanceof File) || file.size === 0) return { error: "Add a photo of your NYSC ID card." };
  if (file.size > MAX_ID_CARD_BYTES) return { error: "That photo is too large. Try another." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImage(bytes);
  if (!mime) return { error: "Use a JPG, PNG or WebP photo." };
  const [taken] = await sql`
    SELECT 1 FROM users WHERE state_code = ${code} AND id <> ${user.id} AND verification_status IN ('verified', 'pending')
  `;
  if (taken) return { error: "This state code is already used by another account." };
  await sql`
    UPDATE users SET state_code = ${code}, id_card_data = ${Buffer.from(bytes).toString("base64")}, id_card_mime = ${mime},
      verification_status = 'pending', verification_requested_at = now(), verification_note = NULL
    WHERE id = ${user.id}
  `;
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removePhoto() {
  const user = await me();
  await sql`UPDATE users SET photo_data = NULL, photo_mime = NULL, photo_version = 0 WHERE id = ${user.id}`;
  revalidatePath("/", "layout");
}

export async function deleteAccount(fd: FormData) {
  const user = await me();
  if (String(fd.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return;
  await destroySession();
  await sql`DELETE FROM users WHERE id = ${user.id}`;
  revalidateTag("stats");
  redirect("/");
}
