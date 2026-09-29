import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Landing from "@/components/Landing";
import { getCurrentUser } from "@/lib/session";
import { getPrizeText, getPublicStats, track } from "@/lib/stats";
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
  const description = "Join corpers across Nigeria. Prizes for the first 500 people.";
  return { title: { absolute: title }, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

/** Referral landing page. The middleware stores the code in a cookie so sign-up can credit the inviter. */
export default async function ReferralLanding({ params }: Params) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (user) redirect(user.completed_at ? "/home" : "/join");

  const [stats, prizeText, inviter] = await Promise.all([getPublicStats(), getPrizeText(), findInviter(code)]);
  await track("landing_view", null, { referred: Boolean(inviter), code });
  return <Landing stats={stats} prizeText={prizeText} inviter={inviter} />;
}
