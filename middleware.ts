import { NextRequest, NextResponse } from "next/server";

const MONTH = 60 * 60 * 24 * 30;

/**
 * Invite links (/r/<code>) and profile links (/u/<code>) remember the code for 30 days (most recent link
 * wins), so sign-up credits that person. A profile link also remembers to follow them once you've joined.
 * Challenge entry links (/c/<entry code>) remember the entry instead: sign-up credits the entry's owner and
 * the entry (lib/signup.ts referrerFromCookie). A shared checklist link (/nysc-checklist?ref=<code>) works like an
 * invite link. Whichever link was opened last wins.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const match = req.nextUrl.pathname.match(/^\/(r|u|c)\/([A-Za-z0-9]{2,24})\/?$/);
  // Shared checklist links carry the sharer's invite code (/nysc-checklist?ref=<code>).
  const ref = req.nextUrl.pathname === "/nysc-checklist" ? req.nextUrl.searchParams.get("ref") : null;
  if (ref && /^[A-Za-z0-9]{2,24}$/.test(ref)) {
    const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: MONTH };
    res.cookies.set("km_ref", ref.toLowerCase(), opts);
    res.cookies.delete("km_entry");
  }
  if (match) {
    const code = match[2].toLowerCase();
    const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: MONTH };
    if (match[1] === "c") {
      res.cookies.set("km_entry", code, opts);
      res.cookies.delete("km_ref");
    } else {
      res.cookies.set("km_ref", code, opts);
      res.cookies.delete("km_entry");
    }
    if (match[1] === "u") res.cookies.set("km_follow", code, opts);
  }
  return res;
}

export const config = { matcher: ["/r/:path*", "/u/:path*", "/c/:path*", "/nysc-checklist"] };
