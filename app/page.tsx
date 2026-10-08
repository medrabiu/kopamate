import type { Metadata } from "next";
import Landing from "@/components/Landing";
import LandingBeacon from "@/components/landing/LandingBeacon";
import { getEarlyDeadline, getPublicStats } from "@/lib/stats";
import { getLandingLeague } from "@/lib/league";

// The same page for every visitor, served from the cache and refreshed every minute (live numbers stay close).
// Signed-in people never see it: the middleware sends them to /home.
export const revalidate = 60;

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const [stats, earlyDeadline, league] = await Promise.all([getPublicStats(), getEarlyDeadline(), getLandingLeague()]);
  return (
    <>
      <Landing stats={stats} earlyDeadline={earlyDeadline} league={league} />
      <LandingBeacon />
    </>
  );
}
