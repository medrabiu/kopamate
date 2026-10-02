import type { Metadata } from "next";
import Link from "next/link";
import ShareButtons from "@/components/ShareButtons";
import { ChevronRight, TrophyIcon } from "@/components/icons";
import { requireUser } from "@/lib/session";
import { getReferrerStanding } from "@/lib/ranking";
import { PLACES_PER_REFERRAL, TOP_REFERRERS, referralLink, shareMessage, whatsappShareUrl } from "@/lib/config";
import { sql } from "@/lib/db";
import { formatNumber, timeAgo } from "@/lib/util";
import { topBadge } from "@/lib/badges";
import type { BadgeInfo } from "@/lib/badge-meta";
import FriendsJoined from "./FriendsJoined";

export const metadata: Metadata = { title: "Invite friends" };

export default async function InvitePage() {
  const user = await requireUser();
  const [joined, { me, above }] = await Promise.all([
    sql<{ id: string; nickname: string; photo_version: number; completed_at: Date; top_badge: BadgeInfo | null }[]>`
      SELECT u.id, u.nickname, u.photo_version, u.completed_at, ${topBadge()} FROM users u
      WHERE u.referred_by = ${user.id} AND u.completed_at IS NOT NULL AND NOT u.is_banned AND NOT u.is_flagged
      ORDER BY u.completed_at DESC LIMIT 100
    `,
    getReferrerStanding(user.id),
  ]);

  // Valid referrals (the same count that ranks you), and the next person to pass nationally.
  const refs = me?.refs ?? 0;
  let goal: string;
  let progress: number;
  if (!me) {
    goal = "Invite 1 friend to get on the leaderboard";
    progress = 0;
  } else if (!above) {
    goal = "You're #1 nationwide. Keep going to stay on top.";
    progress = 1;
  } else {
    const need = above.refs - me.refs + 1;
    goal = `${need} more to pass ${above.nickname} (#${above.rank})`;
    progress = me.refs / (above.refs + 1);
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="h-display text-[28px]">Invite friends</h1>
        <p className="text-[15px] leading-normal text-muted">
          Every friend who joins with your link moves you <span className="font-bold text-lime-ink">up {PLACES_PER_REFERRAL} places</span>.
        </p>
      </div>

      <section className="card flex flex-col gap-4 !p-[22px]" aria-labelledby="progress-title">
        <div className="flex flex-col gap-0.5">
          <h2 id="progress-title" className="h-display text-[34px] leading-tight text-lime-ink">
            {refs === 0 ? "No friends yet" : `${formatNumber(refs)} ${refs === 1 ? "friend" : "friends"} joined`}
          </h2>
          <p className="text-sm text-muted">
            {refs === 0
              ? "Your first friend moves you up straight away."
              : `You've moved up ${formatNumber(refs * PLACES_PER_REFERRAL)} places.`}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <div
            className="h-2 rounded-full bg-surface-2"
            role="progressbar"
            aria-label={goal}
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-2 rounded-full bg-lime" style={{ width: `${Math.max(4, progress * 100)}%` }} />
          </div>
          <p className="text-sm font-medium">{goal}</p>
        </div>
        <ShareButtons
          variant="full"
          link={referralLink(user.referral_code)}
          whatsappUrl={whatsappShareUrl(user.referral_code)}
          message={shareMessage(user.referral_code)}
        />
      </section>

      <FriendsJoined
        friends={joined.map((j) => ({
          id: j.id,
          nickname: j.nickname,
          photo_version: j.photo_version,
          ago: timeAgo(j.completed_at),
          top_badge: j.top_badge,
        }))}
      />

      <Link href="/rewards" className="flex items-center gap-3.5 rounded-[20px] border-[1.5px] border-pink px-[18px] py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pink text-on-accent">
          <TrophyIcon size={20} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">
            {me ? `#${me.rank} nationwide · #${me.state_rank} in ${user.state}` : "Not on the leaderboard yet"}
          </span>
          <span className="block text-sm text-muted">
            Top {TOP_REFERRERS} verified referrers win prizes.{" "}
            {user.verification_status === "verified" ? "See the leaderboard." : "Get verified in Profile to qualify."}
          </span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-pink-ink" />
      </Link>
    </>
  );
}
