"use server";

import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { sql } from "@/lib/db";
import { destroySession, getCurrentUser } from "@/lib/session";
import { normalizeNigerianPhone, normalizeStateCode, validateFullName, validatePin, validateUsername } from "@/lib/validate";
import { isUniqueViolation, isUsernameViolation, usernameTaken, usernameTakenError, whatsappTaken } from "@/lib/signup";
import { checkAutoBadges } from "@/lib/badges";
import { isState, stateCodeProblem } from "@/lib/states";
import { batchFromStateCode, batchProblem, isStage, STATE_LABEL } from "@/lib/nysc";
import { verificationBlock } from "@/lib/verification";
import { sniffImage } from "@/lib/image";

export type ProfileState = { error?: string; ok?: boolean } | undefined;

async function me() {
  const user = await getCurrentUser();
  if (!user || !user.completed_at) redirect("/login");
  return user;
}

export async function updateField(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await me();
  const field = String(fd.get("field") ?? "");
  // The phone input keeps its own name; the others post "value".
  const value = String(fd.get(field === "whatsapp" ? field : "value") ?? "");

  switch (field) {
    case "nickname": {
      const nick = validateUsername(value);
      if (!nick.ok) return { error: nick.error };
      if (await usernameTaken(nick.value, user.id)) return { error: await usernameTakenError(nick.value) };
      try {
        await sql`UPDATE users SET nickname = ${nick.value} WHERE id = ${user.id}`;
      } catch (err) {
        if (isUsernameViolation(err)) return { error: await usernameTakenError(nick.value) };
        throw err;
      }
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
    case "full_name": {
      const name = validateFullName(value);
      if (!name.ok) return { error: name.error };
      await sql`UPDATE users SET full_name = ${name.value} WHERE id = ${user.id}`;
      break;
    }
    case "state":
      // Users can't change their state once they've joined; an admin can (admin user page).
      return { error: "Your state can't be changed after you join. Message us on WhatsApp if it's wrong." };
    case "state_code":
      // State codes are only added through Get verified, where they're checked (see requestVerification).
      return { error: "Add your state code in Get verified on your Profile." };
    default:
      return { error: "Something went wrong. Try again." };
  }
  await checkAutoBadges(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Where you are in NYSC, and your batch. Used by Settings and by Home's one-time "confirm" card. Someone
 * awaiting call-up picked where they live, so they can set their state here once they're posted; everyone
 * else keeps the state they joined with (an admin can change it).
 */
export async function updateNyscStatus(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await me();
  const stage = String(fd.get("stage") ?? "");
  if (!isStage(stage)) return { error: "Pick where you are in NYSC." };

  let batch: string | null = null;
  if (stage !== "waiting") {
    const year = String(fd.get("batch_year") ?? "");
    const letter = String(fd.get("batch_letter") ?? "");
    const stream = String(fd.get("batch_stream") ?? "");
    if (year || letter) {
      if (!/^\d{4}$/.test(year) || !/^[ABC]$/.test(letter)) return { error: "Pick both the year and the batch letter." };
      batch = `${year}${letter}${/^[12]$/.test(stream) ? stream : ""}`;
    } else if (stage !== "served") {
      return { error: "Pick your batch. It's on your call-up letter." };
    }
  }
  const problem = batchProblem(stage, batch);
  if (problem) return { error: problem };

  let state = user.state;
  if (user.nysc_stage === "waiting" || !user.state) {
    const picked = String(fd.get("state") ?? "");
    if (picked) {
      if (!isState(picked)) return { error: `Choose the ${STATE_LABEL[stage].toLowerCase()}.` };
      state = picked;
    } else if (stage !== "waiting") {
      return { error: `Choose the ${STATE_LABEL[stage].toLowerCase()}.` };
    }
  }

  await sql`
    UPDATE users SET nysc_stage = ${stage}, nysc_batch = ${batch}, stage_confirmed_at = now(), state = ${state},
      state_changed_at = CASE WHEN state IS DISTINCT FROM ${state} THEN now() ELSE state_changed_at END
    WHERE id = ${user.id}
  `;
  revalidateTag("stats");
  revalidateTag("league");
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

const MAX_THUMB_BYTES = 40 * 1024;

/**
 * The phone resizes the photo (max 400×400) before upload, which also strips metadata, and sends a
 * 144×144 thumbnail too, so lists on slow connections load a few KB per avatar instead of the full photo.
 */
export async function uploadPhoto(fd: FormData): Promise<ProfileState> {
  const user = await me();
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "That photo is too large. Try another." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImage(bytes);
  if (!mime) return { error: "Use a JPG, PNG or WebP photo." };
  // The thumbnail is optional: without it, small avatars fall back to the full photo.
  let thumb: { data: string; mime: string } | null = null;
  const thumbFile = fd.get("thumb");
  if (thumbFile instanceof File && thumbFile.size > 0 && thumbFile.size <= MAX_THUMB_BYTES) {
    const tb = new Uint8Array(await thumbFile.arrayBuffer());
    const tm = sniffImage(tb);
    if (tm) thumb = { data: Buffer.from(tb).toString("base64"), mime: tm };
  }
  await sql`
    UPDATE users SET photo_data = ${Buffer.from(bytes).toString("base64")}, photo_mime = ${mime},
      photo_thumb_data = ${thumb?.data ?? null}, photo_thumb_mime = ${thumb?.mime ?? null},
      photo_version = photo_version + 1
    WHERE id = ${user.id}
  `;
  await checkAutoBadges(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

const MAX_ID_CARD_BYTES = 900 * 1024;

/** Sends the state code and an ID card photo for an admin to check. The phone resizes the photo first. */
export async function requestVerification(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await me();
  if (user.verification_status === "verified") return { ok: true };
  if (user.verification_status === "pending") return { error: "We're already checking your ID." };
  const block = verificationBlock(user);
  if (block) return { error: block };

  const name = validateFullName(String(fd.get("full_name") ?? ""));
  if (!name.ok) return { error: name.error };
  if (!name.value) return { error: "Enter your full name as it is on your ID card." };
  const code = normalizeStateCode(String(fd.get("state_code") ?? ""));
  if (!code) return { error: "Enter your state code, like LA/26B/1234." };
  const problem = stateCodeProblem(user.state, code);
  if (problem) return { error: problem };
  const [blocked] = await sql`SELECT 1 FROM blocked_state_codes WHERE code = ${code}`;
  if (blocked) return { error: "This state code can't be used. Message us on WhatsApp if it's really yours." };

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

  // Fingerprints of the photo (never the photo itself) so admins can spot one ID card on several accounts.
  const sha = createHash("sha256").update(bytes).digest("hex");
  const dhashHex = String(fd.get("card_dhash") ?? "");
  const dhash = /^[0-9a-f]{16}$/.test(dhashHex) ? BigInt.asIntN(64, BigInt(`0x${dhashHex}`)).toString() : null;

  const updated = await sql`
    UPDATE users SET full_name = ${name.value}, state_code = ${code}, nysc_batch = COALESCE(nysc_batch, ${batchFromStateCode(code)}),
      id_card_data = ${Buffer.from(bytes).toString("base64")}, id_card_mime = ${mime},
      verification_status = 'pending', verification_requested_at = now(), verification_note = NULL,
      verification_attempts = verification_attempts + 1
    WHERE id = ${user.id} AND verification_status IN ('none', 'rejected')
    RETURNING id
  `;
  if (updated.length === 0) return { error: "Something changed. Refresh and try again." };
  await sql`INSERT INTO id_card_fingerprints (user_id, sha256, dhash, state_code) VALUES (${user.id}, ${sha}, ${dhash}, ${code})`;
  await sql`
    INSERT INTO verification_events (user_id, action, state_code, actor) VALUES (${user.id}, 'requested', ${code}, 'user')
  `;
  await checkAutoBadges(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removePhoto() {
  const user = await me();
  await sql`
    UPDATE users SET photo_data = NULL, photo_mime = NULL, photo_thumb_data = NULL, photo_thumb_mime = NULL, photo_version = 0
    WHERE id = ${user.id}
  `;
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
