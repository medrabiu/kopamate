import { redirect } from "next/navigation";
import { after } from "next/server";
import Landing from "@/components/Landing";
import { getCurrentUser } from "@/lib/session";
import { getEarlyDeadline, getPrizeText, getPublicStats, track } from "@/lib/stats";
import { referrerFromCookie } from "@/lib/signup";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(user.completed_at ? "/home" : "/join");

  const [stats, prizeText, inviter, earlyDeadline] = await Promise.all([
    getPublicStats(),
    getPrizeText(),
    referrerFromCookie(),
    getEarlyDeadline(),
  ]);
  // Logged after the page is sent, so a slow connection doesn't wait on analytics.
  after(() => track("landing_view", null, { referred: Boolean(inviter) }));
  return <Landing stats={stats} prizeText={prizeText} inviter={inviter} earlyDeadline={earlyDeadline} />;
}
