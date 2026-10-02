import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import Avatar from "@/components/Avatar";
import BadgeCelebration from "@/components/BadgeCelebration";
import BadgeIcon from "@/components/BadgeIcon";
import { ProfileProgressRow } from "@/components/ProfileProgress";
import ComingSoon from "@/components/ComingSoon";
import Confetti from "@/components/Confetti";
import Countdown, { Deadline } from "@/components/Countdown";
import CountUp from "@/components/CountUp";
import { PersonButton } from "@/components/PersonSheet";
import RewardBanner from "@/components/RewardBanner";
import { ArrowDownIcon, ArrowUpIcon, ChevronRight, ClockIcon } from "@/components/icons";
import { requireUser } from "@/lib/session";
import { getRank, getSnapshotPosition, nextGoal } from "@/lib/ranking";
import { getAnnouncement, getEarlyDeadline, getPublicStats, track } from "@/lib/stats";
import { checkAutoBadges, getProfileSteps, getUserBadges, topBadge } from "@/lib/badges";
import type { BadgeInfo } from "@/lib/badge-meta";
import { shareMessage, whatsappShareUrl } from "@/lib/config";
import { sql } from "@/lib/db";
import { formatNumber, lagosDate } from "@/lib/util";
import { stateSlug } from "@/lib/states";
import HomeShare from "./HomeShare";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser();
  const { welcome } = await searchParams;
  const today = lagosDate();

  // Auto badges are checked on every Home visit (cheap and idempotent), then read back.
  const badgesReady = checkAutoBadges(user.id);
  const [rank, stats, announcement, snapshot, newcomers, earlyDeadline, steps, badges, myRewards] = await Promise.all([
    getRank(user.id),
    getPublicStats(),
    getAnnouncement(),
    getSnapshotPosition(user.id, today),
    sql<{ id: string; nickname: string; photo_version: number; top_badge: BadgeInfo | null }[]>`
      SELECT u.id, u.nickname, u.photo_version, ${topBadge()} FROM users u
      WHERE u.state = ${user.state} AND u.id <> ${user.id} AND u.completed_at IS NOT NULL
        AND NOT u.is_banned AND u.show_in_list
      ORDER BY u.completed_at DESC LIMIT 5
    `,
    getEarlyDeadline(),
    badgesReady.then(() => getProfileSteps(user.id)),
    badgesReady.then(() => getUserBadges(user.id)),
    // Rewards waiting for the user (no payout details here).
    sql<{ id: string; status: "hidden" | "unclaimed"; amount_ngn: number | null }[]>`
      SELECT id, status, amount_ngn FROM rewards WHERE user_id = ${user.id} AND status IN ('hidden', 'unclaimed')
    `,
  ]);
  const unclaimed = myRewards.filter((r) => r.status === "unclaimed");
  const profileComplete = badges.find((b) => b.slug === "profile_complete");

  const position = rank?.position ?? 0;
  const refs = rank?.refs ?? 0;
  const change = snapshot ? snapshot - position : 0;
  const goal = nextGoal(position);
  const myState = stats.states.find((s) => s.state === user.state);

  // Celebrate new sign-ups and any climb since the last visit.
  const improved = user.last_seen_position !== null && position > 0 && position < user.last_seen_position;
  const celebrate = welcome === "1" || improved;
  if (user.last_seen_on !== today || user.last_seen_position !== position) {
    // Bookkeeping runs after the page is sent, so slow connections don't wait on it.
    after(() =>
      Promise.all([
        sql`UPDATE users SET last_seen_on = ${today}::date, last_seen_position = ${position} WHERE id = ${user.id}`,
        user.last_seen_on !== today ? track("daily_return", user.id) : null,
      ]),
    );
  }

  const earlyOpen = new Date(earlyDeadline).getTime() > Date.now();

  return (
    <>
      <Confetti fire={celebrate} />
      {profileComplete && (
        <BadgeCelebration slug="profile_complete" name="Profile Complete" awardedAt={new Date(profileComplete.awarded_at).toISOString()} />
      )}
      <header className="flex h-11 items-center justify-between">
        <h1 className="h-display text-2xl">Hi, {user.nickname}</h1>
        <Link href="/profile" aria-label="Your profile">
          <Avatar id={user.id} nickname={user.nickname} photoVersion={user.photo_version} size={40} />
        </Link>
      </header>

      <RewardBanner
        unclaimedIds={unclaimed.map((r) => r.id)}
        unclaimedTotal={unclaimed.reduce((s, r) => s + (r.amount_ngn ?? 0), 0)}
        hiddenCount={myRewards.length - unclaimed.length}
        underReview={user.is_flagged}
      />

      {/* Position: the one thing Home is about, with both ways to share. */}
      <section className="card flex flex-col gap-4 !p-[22px]" aria-labelledby="position-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="position-title" className="text-sm text-muted">
              Your position
            </h2>
            <div className="h-display text-[64px] leading-[0.95] text-lime-ink">
              <CountUp to={position} from={improved && user.last_seen_position ? user.last_seen_position : position} prefix="#" />
            </div>
          </div>
          {change > 0 && (
            <div className="mt-1 flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1.5 text-[13px] font-bold text-lime-ink">
              <ArrowUpIcon size={14} strokeWidth={2.5} />
              {change} since yesterday
            </div>
          )}
          {change < 0 && (
            <div className="mt-1 flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1.5 text-[13px] font-bold text-muted">
              <ArrowDownIcon size={14} strokeWidth={2.5} />
              {Math.abs(change)} since yesterday
            </div>
          )}
        </div>

        {goal ? (
          <div className="flex flex-col gap-2">
            <div className="h-2 rounded-full bg-surface-2" role="progressbar" aria-label="Progress to your next goal" aria-valuenow={Math.round(goal.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-2 rounded-full bg-lime" style={{ width: `${Math.max(4, goal.progress * 100)}%` }} />
            </div>
            <p className="text-sm">
              Invite <span className="font-bold">{goal.invites} more</span> to reach the top {goal.target}
            </p>
          </div>
        ) : (
          <p className="text-sm font-bold text-lime-ink">You&apos;re in the top 10. Keep inviting to stay there.</p>
        )}

        <HomeShare
          whatsappUrl={whatsappShareUrl(user.referral_code)}
          cardUrl={`/card/${user.referral_code}`}
          message={shareMessage(user.referral_code)}
          fileName={`kopamate-${user.referral_code}.png`}
        />

        <div className="-mb-1 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
          <Link href="/invite" className="text-muted">
            {refs === 0 ? "No friends joined yet" : `${refs} ${refs === 1 ? "friend" : "friends"} joined`}
            <span className="font-bold text-lime-ink"> · Invite</span>
          </Link>
          {earlyOpen && (
            <Deadline to={earlyDeadline}>
              <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-muted">
                <ClockIcon size={14} className="text-lime-ink" />
                Early Corper
                <Countdown to={earlyDeadline} className="font-bold text-lime-ink" />
              </span>
            </Deadline>
          )}
        </div>
      </section>

      {announcement && (
        <section className="flex flex-col gap-2 rounded-3xl border-[1.5px] border-pink p-[22px]" aria-label="Announcement">
          <h2 className="h-display text-[22px] leading-tight text-pink-ink">{announcement.title}</h2>
          {announcement.body && <p className="text-[15px] leading-normal">{announcement.body}</p>}
          {announcement.buttonLabel && announcement.buttonUrl && (
            <a
              href={announcement.buttonUrl}
              {...(announcement.buttonUrl.startsWith("https://") ? { target: "_blank", rel: "noopener" } : {})}
              className="mt-1 flex h-11 items-center justify-center self-start rounded-full bg-pink px-5 text-[15px] font-bold text-on-accent"
            >
              {announcement.buttonLabel}
            </a>
          )}
        </section>
      )}

      <ProfileProgressRow steps={steps} />

      {newcomers.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="new-title">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="new-title" className="h-display text-xl">
              New from {user.state}
            </h2>
            <Link href={`/corpers/${stateSlug(user.state ?? "")}`} className="flex items-center gap-0.5 py-1 text-sm font-medium text-lime-ink">
              {formatNumber(myState?.count ?? 0)} corpers
              <ChevronRight size={16} />
            </Link>
          </div>
          <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
            {newcomers.map((n) => (
              <PersonButton key={n.id} id={n.id} label={n.nickname} className="flex w-[60px] shrink-0 flex-col items-center gap-1.5">
                <Avatar id={n.id} nickname={n.nickname} photoVersion={n.photo_version} size={56} />
                <span className="flex w-full items-center justify-center gap-1 text-xs text-muted">
                  <span className="truncate">{n.nickname}</span>
                  <BadgeIcon badge={n.top_badge} size={14} />
                </span>
              </PersonButton>
            ))}
          </div>
        </section>
      )}

      <ComingSoon layout="tiles" state={user.state} />
    </>
  );
}
