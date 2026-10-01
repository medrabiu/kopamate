import { redirect } from "next/navigation";
import Landing from "@/components/Landing";
import { getCurrentUser } from "@/lib/session";
import { getEarlyDeadline, getPrizeText, getPublicStats, track } from "@/lib/stats";
import { referrerFromCookie } from "@/lib/signup";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(user.completed_at ? "/home" : "/join");

  const [stats, prizeText, ref, earlyDeadline] = await Promise.all([getPublicStats(), getPrizeText(), referrerFromCookie(), getEarlyDeadline()]);
  let inviter = null;
  if (ref) {
    const rows = await sql<{ id: string; nickname: string; photo_version: number }[]>`
      SELECT id, nickname, photo_version FROM users WHERE id = ${ref.id}
    `;
    inviter = rows[0] ?? null;
  }
  await track("landing_view", null, { referred: Boolean(inviter) });
  return <Landing stats={stats} prizeText={prizeText} inviter={inviter} earlyDeadline={earlyDeadline} />;
}
