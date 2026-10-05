import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { after } from "next/server";
import Landing from "@/components/Landing";
import { getCurrentUser } from "@/lib/session";
import { getEarlyDeadline, getPublicStats, track } from "@/lib/stats";
import { getLandingLeague } from "@/lib/league";
import { sql } from "@/lib/db";
import { APP_NAME } from "@/lib/config";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

async function findInviter(code: string) {
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, "");
  const rows = await sql<{ id: string; nickname: string; photo_version: number }[]>`
    SELECT id, nickname, photo_version FROM users
    WHERE referral_code = ${clean} AND completed_at IS NOT NULL AND NOT is_banned
  `;
  return rows[0] ?? null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  const inviter = await findInviter(code);
  const title = inviter ? `${inviter.nickname} invited you to ${APP_NAME}` : `${APP_NAME}: every corper, one place`;
  const description = "The free app for NYSC corps members across Nigeria. Find corpers in your state, earn badges and win prizes.";
  return {
    title: { absolute: title },
    description,
    // Thousands of invite links share the landing page: send search engines to / instead.
    alternates: { canonical: "/" },
    robots: { index: false, follow: true },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * Invite links show the same landing page as /. The middleware stores the code in a cookie, so sign-up
 * still credits the inviter; the link preview (above) is where the inviter's name appears.
 */
export default async function ReferralLanding({ params }: Params) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (user) redirect(user.completed_at ? "/home" : "/join");

  const [stats, inviter, earlyDeadline, league] = await Promise.all([
    getPublicStats(),
    findInviter(code),
    getEarlyDeadline(),
    getLandingLeague(),
  ]);
  after(() => track("landing_view", null, { referred: Boolean(inviter), code }));
  return <Landing stats={stats} earlyDeadline={earlyDeadline} league={league} inviter={inviter} />;
}
