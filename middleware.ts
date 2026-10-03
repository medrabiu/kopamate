import { NextRequest, NextResponse } from "next/server";

const MONTH = 60 * 60 * 24 * 30;

/**
 * Invite links (/r/<code>) and profile links (/u/<code>) remember the code for 30 days (most recent link
 * wins), so sign-up credits that person. A profile link also remembers to follow them once you've joined.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const match = req.nextUrl.pathname.match(/^\/(r|u)\/([A-Za-z0-9]{2,24})\/?$/);
  if (match) {
    const code = match[2].toLowerCase();
    const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: MONTH };
    res.cookies.set("km_ref", code, opts);
    if (match[1] === "u") res.cookies.set("km_follow", code, opts);
  }
  return res;
}

export const config = { matcher: ["/r/:path*", "/u/:path*"] };
