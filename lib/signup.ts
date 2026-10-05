import "server-only";
import { cookies, headers } from "next/headers";
import { sql } from "./db";
import { MAX_SIGNUPS_PER_IP_PER_HOUR } from "./config";
import { clientIp, hashIp, randomDigits, referralCodeBase } from "./util";
import { entryOwner, recordChallengeSignup } from "./challenge-signups";

export const REF_COOKIE = "km_ref";
/** Set by challenge entry links (/c/<code>): credits the entry's owner, and the entry. */
export const ENTRY_COOKIE = "km_entry";
/** Set by profile links (/u/<code>): follow that person once sign-up is done. */
export const FOLLOW_COOKIE = "km_follow";

/** Generates a unique referral code like "ada347". */
export async function uniqueReferralCode(nickname: string) {
  const base = referralCodeBase(nickname);
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = base + randomDigits(attempt < 4 ? 3 : 5);
    const rows = await sql`SELECT 1 FROM users WHERE referral_code = ${code}`;
    if (rows.length === 0) return code;
  }
  return base + randomDigits(8);
}

/** True if someone else already has this username (capitals don't matter). */
export async function usernameTaken(username: string, exceptUserId?: string) {
  const rows = await sql`
    SELECT 1 FROM users WHERE lower(nickname) = lower(${username})
    ${exceptUserId ? sql`AND id <> ${exceptUserId}` : sql``}
  `;
  return rows.length > 0;
}

/** `base` if it's free, otherwise base with a few digits ("ada" → "ada_482"), kept within 20 characters. */
export async function uniqueUsername(base: string) {
  if (!(await usernameTaken(base))) return base;
  for (let attempt = 0; attempt < 8; attempt++) {
    const suffix = "_" + randomDigits(attempt < 4 ? 3 : 5);
    const name = base.slice(0, 20 - suffix.length) + suffix;
    if (!(await usernameTaken(name))) return name;
  }
  return base.slice(0, 11) + "_" + randomDigits(8);
}

/** The error for a username someone already has, with a free one to try. */
export async function usernameTakenError(username: string) {
  return `@${username} is taken. Try @${await uniqueUsername(username)}.`;
}

/** A unique-index clash on the username (two people saving the same one at once). */
export function isUsernameViolation(err: unknown) {
  return isUniqueViolation(err) && (err as { constraint_name?: string }).constraint_name === "users_username_idx";
}

export async function currentIpHash() {
  return hashIp(clientIp(await headers()));
}

/** True if this IP has created too many accounts in the last hour. */
export async function ipLimited(ipHash: string | null) {
  if (!ipHash) return false;
  const [row] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM users
    WHERE signup_ip_hash = ${ipHash} AND created_at > now() - interval '1 hour'
  `;
  return (row?.n ?? 0) >= MAX_SIGNUPS_PER_IP_PER_HOUR;
}

/**
 * The referrer from the km_ref cookie (or, after a challenge entry link, the entry's owner from km_entry),
 * if it points to a real, active, completed user.
 */
export async function referrerFromCookie(excludeUserId?: string): Promise<{ id: string; nickname: string; photo_version: number } | null> {
  const jar = await cookies();
  const code = jar.get(REF_COOKIE)?.value;
  if (code) return referrerByCode(code, excludeUserId);
  const entry = jar.get(ENTRY_COOKIE)?.value;
  if (!entry) return null;
  const owner = await entryOwner(sql, entry);
  return owner && owner.id !== excludeUserId ? { id: owner.id, nickname: owner.nickname, photo_version: owner.photo_version } : null;
}

/** After sign-up with a referrer: credit any open challenge they're in (and the entry link used, if any). */
export async function creditChallenges(newUserId: string, referrerId: string) {
  try {
    const entryCode = (await cookies()).get(ENTRY_COOKIE)?.value ?? null;
    await recordChallengeSignup(sql, { newUserId, referrerId, entryCode });
  } catch (err) {
    // Sign-up must never fail because of a challenge.
    console.error("challenge sign-up not recorded", err);
  }
}

export async function referrerByCode(code: string, excludeUserId?: string) {
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!clean) return null;
  const rows = await sql<{ id: string; nickname: string; photo_version: number }[]>`
    SELECT id, nickname, photo_version FROM users
    WHERE referral_code = ${clean} AND completed_at IS NOT NULL AND NOT is_banned
  `;
  const r = rows[0];
  if (!r || r.id === excludeUserId) return null;
  return r;
}

/** After sign-up: follow whoever's profile link brought you here, then forget it. */
export async function followFromCookie(userId: string) {
  const jar = await cookies();
  const code = jar.get(FOLLOW_COOKIE)?.value;
  if (!code) return;
  jar.delete(FOLLOW_COOKIE);
  const target = await referrerByCode(code, userId);
  if (!target) return;
  await sql`INSERT INTO follows (follower_id, following_id) VALUES (${userId}, ${target.id}) ON CONFLICT DO NOTHING`;
}

export async function whatsappTaken(e164: string, exceptUserId?: string) {
  const rows = await sql`SELECT id FROM users WHERE whatsapp_e164 = ${e164}`;
  return rows.some((r) => r.id !== exceptUserId);
}

export function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}
