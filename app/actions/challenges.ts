"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { sniffImage } from "@/lib/image";
import { cleanHandle, FORMATS, normalizePostUrl, PLATFORM_LABEL, type Format } from "@/lib/challenge-rules";
import { countsTowardLimit, getChallenge, getMyEntries, getParticipant, isOpen, metricsOpen, newEntryCode } from "@/lib/challenges";
import { isUniqueViolation } from "@/lib/signup";

export type ChallengeFormState = { error?: string; ok?: boolean; fields?: Record<string, string> } | undefined;

const MAX_SCREENSHOT_BYTES = 500 * 1024;
const ticked = (fd: FormData, name: string) => fd.get(name) === "on";

async function challengeFor(fd: FormData) {
  const c = await getChallenge(String(fd.get("slug") ?? ""));
  if (!c) throw new Error("No such challenge");
  return c;
}

/** Join: verified account, at least one handle, follows confirmed, rules accepted. Then you're in. */
export async function joinChallenge(_prev: ChallengeFormState, fd: FormData): Promise<ChallengeFormState> {
  const user = await requireUser();
  const c = await challengeFor(fd);
  const fields = Object.fromEntries(["x_handle", "tiktok_handle", "instagram_handle"].map((k) => [k, String(fd.get(k) ?? "")]));
  if (c.status !== "open" && c.status !== "upcoming") return { error: "This challenge isn't taking new people.", fields };
  if (user.verification_status !== "verified") return { error: "Get verified first. It's in your Profile.", fields };
  if (user.is_flagged) return { error: "Your account is under review, so you can't join right now.", fields };

  const handles: Record<string, string | null> = {};
  for (const k of ["x_handle", "tiktok_handle", "instagram_handle"]) {
    const raw = fields[k].trim();
    const h = raw ? cleanHandle(raw) : null;
    if (raw && !h) return { error: `"${raw}" doesn't look like a handle. Use letters, numbers, _ or . only.`, fields };
    handles[k] = h;
  }
  if (!handles.x_handle && !handles.tiktok_handle && !handles.instagram_handle) {
    return { error: "Add the handle of at least one account you'll post from.", fields };
  }
  const followX = ticked(fd, "follow_x");
  const followOther = ticked(fd, "follow_other");
  const whatsapp = ticked(fd, "whatsapp");
  if (!followX) return { error: "Follow us on X and tick the box.", fields };
  if ((handles.tiktok_handle || handles.instagram_handle) && !followOther) {
    return { error: "Follow us on TikTok or Instagram (where you post) and tick the box.", fields };
  }
  if (!whatsapp) return { error: "Join our WhatsApp Channel and tick the box.", fields };
  if (!ticked(fd, "rules")) return { error: "Accept the rules to join.", fields };

  await sql`
    INSERT INTO challenge_participants (challenge_id, user_id, x_handle, tiktok_handle, instagram_handle,
      confirmed_follow_x, confirmed_follow_other, confirmed_whatsapp_channel, accepted_rules_at)
    VALUES (${c.id}, ${user.id}, ${handles.x_handle}, ${handles.tiktok_handle}, ${handles.instagram_handle},
      ${followX}, ${followOther}, ${whatsapp}, now())
    ON CONFLICT (challenge_id, user_id) DO UPDATE SET
      x_handle = EXCLUDED.x_handle, tiktok_handle = EXCLUDED.tiktok_handle, instagram_handle = EXCLUDED.instagram_handle,
      confirmed_follow_x = EXCLUDED.confirmed_follow_x, confirmed_follow_other = EXCLUDED.confirmed_follow_other,
      confirmed_whatsapp_channel = EXCLUDED.confirmed_whatsapp_channel
  `;
  revalidatePath(`/challenges/${c.slug}`);
  redirect(`/challenges/${c.slug}/mine?joined=1`);
}

/** Adds a post link as an entry. Each entry gets its own link (/c/<code>) for counting sign-ups. */
export async function submitEntry(_prev: ChallengeFormState, fd: FormData): Promise<ChallengeFormState> {
  const user = await requireUser();
  const c = await challengeFor(fd);
  const fields = { post_url: String(fd.get("post_url") ?? ""), format: String(fd.get("format") ?? ""), note: String(fd.get("note") ?? "") };
  if (!isOpen(c)) return { error: "Entries aren't open right now.", fields };
  const p = await getParticipant(c.id, user.id);
  if (!p) return { error: "Join the challenge first.", fields };
  const entries = await getMyEntries(c.id, user.id);
  if (entries.filter(countsTowardLimit).length >= c.max_entries_per_user) {
    return { error: `You've used all ${c.max_entries_per_user} entries.`, fields };
  }

  const link = normalizePostUrl(fields.post_url);
  if ("error" in link) return { error: link.error, fields };
  const handle = { x: p.x_handle, tiktok: p.tiktok_handle, instagram: p.instagram_handle }[link.platform];
  if (!handle) {
    return { error: `Add your ${PLATFORM_LABEL[link.platform]} handle on the join page first, then add this post.`, fields };
  }
  if (!(FORMATS as readonly string[]).includes(fields.format)) return { error: "Choose what kind of post it is.", fields };
  const note = fields.note.trim().slice(0, 200) || null;
  for (const [name, label] of [
    ["c_public", "your post is public"],
    ["c_tagged", "you tagged us"],
    ["c_link", "your Kopamate link is in the caption or bio"],
    ["c_original", "it's your own original work"],
  ]) {
    if (!ticked(fd, name)) return { error: `Tick to confirm ${label}.`, fields };
  }

  try {
    const code = String(fd.get("entry_code") ?? "");
    // The code shown on the form (so the link could be copied before posting), if it's still free.
    const useCode = /^[a-z0-9]{7}$/.test(code) && !(await sql`SELECT 1 FROM challenge_entries WHERE entry_code = ${code}`).length ? code : await newEntryCode();
    await sql`
      INSERT INTO challenge_entries (challenge_id, user_id, platform, post_url, format, caption_note, entry_code)
      VALUES (${c.id}, ${user.id}, ${link.platform}, ${link.url}, ${fields.format as Format}, ${note}, ${useCode})
    `;
  } catch (err) {
    if (isUniqueViolation(err)) return { error: "This post has already been entered.", fields };
    throw err;
  }
  revalidatePath(`/challenges/${c.slug}/mine`);
  return { ok: true };
}

/** Removes one of your own entries while it's pending or rejected (approved ones stay). */
export async function removeEntry(fd: FormData) {
  const user = await requireUser();
  const c = await challengeFor(fd);
  const id = Number(fd.get("entry_id"));
  if (!Number.isInteger(id)) return;
  await sql`
    DELETE FROM challenge_entries
    WHERE id = ${id} AND user_id = ${user.id} AND challenge_id = ${c.id} AND status IN ('pending', 'rejected')
  `;
  revalidatePath(`/challenges/${c.slug}/mine`);
}

const count = (fd: FormData, name: string) => {
  const raw = String(fd.get(name) ?? "").replace(/[,\s]/g, "");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n < 2_000_000_000 ? n : NaN;
};

/** Post stats with a screenshot of the analytics. Changing them sends them back for checking. */
export async function submitMetrics(_prev: ChallengeFormState, fd: FormData): Promise<ChallengeFormState> {
  const user = await requireUser();
  const c = await challengeFor(fd);
  const id = Number(fd.get("entry_id"));
  const [entry] = await sql<{ submitted_at: Date; status: "pending" | "approved" | "rejected" | "disqualified"; has_shot: boolean }[]>`
    SELECT submitted_at, status, metrics_screenshot IS NOT NULL AS has_shot FROM challenge_entries
    WHERE id = ${Number.isInteger(id) ? id : 0} AND user_id = ${user.id} AND challenge_id = ${c.id}
  `;
  if (!entry) return { error: "Entry not found." };
  if (!metricsOpen(c, entry)) return { error: "Post stats can't be added for this entry right now." };

  const views = count(fd, "views");
  const likes = count(fd, "likes");
  const comments = count(fd, "comments");
  const shares = count(fd, "shares");
  if ([views, likes, comments, shares].some((n) => Number.isNaN(n))) return { error: "Use whole numbers only, like 12500." };
  if (views === null) return { error: "Add the views (or impressions)." };

  const file = fd.get("screenshot");
  let shot: { data: string; mime: string } | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_SCREENSHOT_BYTES) return { error: "That screenshot is too large. Try another." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImage(bytes);
    if (!mime) return { error: "Use a JPG, PNG or WebP screenshot." };
    shot = { data: Buffer.from(bytes).toString("base64"), mime };
  } else if (!entry.has_shot) {
    return { error: "Add a screenshot of the post's stats." };
  }

  await sql`
    UPDATE challenge_entries SET views = ${views}, likes = ${likes}, comments = ${comments}, shares = ${shares},
      metrics_screenshot = COALESCE(${shot?.data ?? null}, metrics_screenshot),
      metrics_screenshot_mime = COALESCE(${shot?.mime ?? null}, metrics_screenshot_mime),
      metrics_submitted_at = now(), metrics_verified = false, metrics_verified_by = NULL
    WHERE id = ${id} AND user_id = ${user.id}
  `;
  revalidatePath(`/challenges/${c.slug}/mine`);
  return { ok: true };
}
