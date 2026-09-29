import { NextResponse } from "next/server";
import { APP_URL, googleEnabled } from "@/lib/config";
import { randomToken } from "@/lib/util";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!googleEnabled()) return NextResponse.redirect(`${APP_URL}/join`);
  const state = randomToken(16);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${APP_URL}/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.cookies.set("km_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
