import { redirect } from "next/navigation";
import { after } from "next/server";
import Landing from "@/components/Landing";
import { getCurrentUser } from "@/lib/session";
import { getEarlyDeadline, getPublicStats, track } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(user.completed_at ? "/home" : "/join");

  const [stats, earlyDeadline] = await Promise.all([getPublicStats(), getEarlyDeadline()]);
  // Logged after the page is sent, so a slow connection doesn't wait on analytics.
  after(() => track("landing_view", null, { referred: false }));
  return <Landing stats={stats} earlyDeadline={earlyDeadline} />;
}
