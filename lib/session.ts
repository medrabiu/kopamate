import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { randomToken, sha256 } from "./util";
import { SESSION_DAYS } from "./config";
import { normalizeNigerianPhone } from "./validate";
import type { Stage } from "./nysc";

export const SESSION_COOKIE = "km_session";

export type User = {
  id: string;
  nickname: string;
  /** Private: shown only to the user and admins. */
  full_name: string | null;
  whatsapp_e164: string | null;
  state: string | null;
  state_code: string | null;
  nysc_stage: Stage;
  /** Like "2026B2" (see lib/nysc.ts). */
  nysc_batch: string | null;
  /** Null for people who joined before NYSC stages existed and haven't confirmed theirs yet. */
  stage_confirmed_at: Date | null;
  photo_version: number;
  google_id: string | null;
  email: string | null;
  has_pin: boolean;
  referral_code: string;
  referred_by: string | null;
  signup_number: number | null;
  completed_at: Date | null;
  show_in_list: boolean;
  state_changed_at: Date | null;
  is_flagged: boolean;
  is_banned: boolean;
  last_seen_on: string | null;
  last_seen_position: number | null;
  created_at: Date;
  verification_status: "none" | "pending" | "verified" | "rejected";
  verification_note: string | null;
  verification_attempts: number;
  verification_rejected_at: Date | null;
};

export const userColumns = () => sql`
  u.id, u.nickname, u.full_name, u.whatsapp_e164, u.state, u.state_code, u.nysc_stage, u.nysc_batch, u.stage_confirmed_at, u.photo_version, u.google_id, u.email,
  (u.pin_hash IS NOT NULL) AS has_pin, u.referral_code, u.referred_by, u.signup_number, u.completed_at,
  u.show_in_list, u.state_changed_at, u.is_flagged, u.is_banned, u.last_seen_on::text AS last_seen_on,
  u.last_seen_position, u.created_at, u.verification_status, u.verification_note,
  u.verification_attempts, u.verification_rejected_at
`;

/** Creates a session and sets the cookie. Call from a server action or route handler only. */
export async function createSession(userId: string) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await sql`INSERT INTO sessions (id, user_id, expires_at) VALUES (${sha256(token)}, ${userId}, ${expires})`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sql`DELETE FROM sessions WHERE id = ${sha256(token)}`;
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user (complete or not), or null. Banned users count as signed out. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await sql<User[]>`
    SELECT ${userColumns()}
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ${sha256(token)} AND s.expires_at > now() AND NOT u.is_banned
  `;
  return rows[0] ?? null;
});

/** For logged-in pages: must be signed in and have finished sign-up. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.completed_at) redirect("/join");
  return user;
}

export function isAdmin(user: Pick<User, "email" | "whatsapp_e164"> | null) {
  if (!user) return false;
  const ids = (process.env.ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const phones = ids.map((id) => normalizeNigerianPhone(id)).filter(Boolean);
  if (user.email && ids.includes(user.email.toLowerCase())) return true;
  if (user.whatsapp_e164 && phones.includes(user.whatsapp_e164)) return true;
  return false;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/home");
  return user;
}
