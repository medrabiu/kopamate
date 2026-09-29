import { NextRequest, NextResponse } from "next/server";

/** Remember the referral code from /r/<code> for 30 days (most recent link wins). */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const match = req.nextUrl.pathname.match(/^\/r\/([A-Za-z0-9]{2,24})\/?$/);
  if (match) {
    res.cookies.set("km_ref", match[1].toLowerCase(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}

export const config = { matcher: ["/r/:path*"] };
