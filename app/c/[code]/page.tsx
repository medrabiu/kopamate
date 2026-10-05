import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { after } from "next/server";
import Landing from "@/components/Landing";
import { getCurrentUser } from "@/lib/session";
import { getEarlyDeadline, getPublicStats, track } from "@/lib/stats";
import { getLandingLeague } from "@/lib/league";
import { entryOwner } from "@/lib/challenge-signups";
import { sql } from "@/lib/db";
import { APP_NAME } from "@/lib/config";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const owner = await entryOwner(sql, (await params).code);
  const title = owner ? `${owner.nickname} invited you to ${APP_NAME}` : `${APP_NAME}: every corper, one place`;
  const description = "The free app for NYSC corps members across Nigeria. Find corpers in your state, earn badges and win prizes.";
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    robots: { index: false, follow: true },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * Challenge entry links show the same landing page as invite links. The middleware stores the entry code in
 * a cookie, so sign-up credits the entry's owner (as their referral) and the entry (lib/challenge-signups.ts).
 */
export default async function EntryLanding({ params }: Params) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (user) redirect(user.completed_at ? "/home" : "/join");

  const [stats, owner, earlyDeadline, league] = await Promise.all([
    getPublicStats(),
    entryOwner(sql, code),
    getEarlyDeadline(),
    getLandingLeague(),
  ]);
  after(() => track("landing_view", null, { referred: Boolean(owner), entry: code }));
  return <Landing stats={stats} earlyDeadline={earlyDeadline} league={league} inviter={owner} />;
}
