import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { APP_URL } from "@/lib/config";
import { createSession } from "@/lib/session";
import { followFromCookie } from "@/lib/signup";
import { currentIpHash, ipLimited, isUsernameViolation, uniqueReferralCode, uniqueUsername } from "@/lib/signup";
import { toUsername, validateUsername } from "@/lib/validate";

export const dynamic = "force-dynamic";

type GoogleProfile = { sub: string; email?: string; given_name?: string; name?: string };

function fail(reason: string) {
  return NextResponse.redirect(`${APP_URL}/login?error=${encodeURIComponent(reason)}`);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("km_oauth_state")?.value;
  if (!code || !state || !expected || state !== expected) return fail("google");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${APP_URL}/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail("google");
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return fail("google");

  const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!profileRes.ok) return fail("google");
  const profile = (await profileRes.json()) as GoogleProfile;
  if (!profile.sub) return fail("google");

  const existing = await sql<{ id: string; is_banned: boolean; completed_at: Date | null }[]>`
    SELECT id, is_banned, completed_at FROM users WHERE google_id = ${profile.sub}
  `;

  let userId: string;
  let complete = false;
  if (existing[0]) {
    if (existing[0].is_banned) return fail("suspended");
    userId = existing[0].id;
    complete = Boolean(existing[0].completed_at);
  } else {
    const ipHash = await currentIpHash();
    if (await ipLimited(ipHash)) return fail("limit");
    // A starting username from their Google name; they confirm or change it when they finish sign-up.
    const suggested = validateUsername(toUsername(profile.given_name || profile.name?.split(" ")[0] || ""));
    const base = suggested.ok ? suggested.value : "corper";
    const referralCode = await uniqueReferralCode(base);
    let row: { id: string } | undefined;
    // Someone may take the same name in the same moment: pick another and try again.
    for (let attempt = 0; !row; attempt++) {
      const nickname = await uniqueUsername(base);
      try {
        [row] = await sql<{ id: string }[]>`
          INSERT INTO users (nickname, google_id, email, referral_code, signup_ip_hash)
          VALUES (${nickname}, ${profile.sub}, ${profile.email ?? null}, ${referralCode}, ${ipHash})
          RETURNING id
        `;
      } catch (err) {
        if (!isUsernameViolation(err) || attempt >= 2) throw err;
      }
    }
    userId = row.id;
  }

  await createSession(userId);
  // Existing accounts follow whoever's profile link brought them here; new ones do it when they finish sign-up.
  if (complete) await followFromCookie(userId);
  const res = NextResponse.redirect(`${APP_URL}${complete ? "/home" : "/join"}`);
  res.cookies.delete("km_oauth_state");
  return res;
}
