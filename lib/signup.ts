import "server-only";
import { cookies, headers } from "next/headers";
import { sql } from "./db";
import { MAX_SIGNUPS_PER_IP_PER_HOUR } from "./config";
import { clientIp, hashIp, randomDigits, referralCodeBase } from "./util";

export const REF_COOKIE = "km_ref";

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

/** The referrer from the km_ref cookie, if it points to a real, active, completed user. */
export async function referrerFromCookie(excludeUserId?: string): Promise<{ id: string; nickname: string } | null> {
  const code = (await cookies()).get(REF_COOKIE)?.value;
  if (!code) return null;
  return referrerByCode(code, excludeUserId);
}

export async function referrerByCode(code: string, excludeUserId?: string) {
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!clean) return null;
  const rows = await sql<{ id: string; nickname: string }[]>`
    SELECT id, nickname FROM users
    WHERE referral_code = ${clean} AND completed_at IS NOT NULL AND NOT is_banned
  `;
  const r = rows[0];
  if (!r || r.id === excludeUserId) return null;
  return r;
}

export async function whatsappTaken(e164: string, exceptUserId?: string) {
  const rows = await sql`SELECT id FROM users WHERE whatsapp_e164 = ${e164}`;
  return rows.some((r) => r.id !== exceptUserId);
}

export function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}
