import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import Avatar from "@/components/Avatar";
import BadgeCelebration from "@/components/BadgeCelebration";
import BadgeIcon from "@/components/BadgeIcon";
import VerifiedBadge from "@/components/VerifiedBadge";
import { ProfileProgressRow } from "@/components/ProfileProgress";
import ComingSoon from "@/components/ComingSoon";
import Confetti from "@/components/Confetti";
import { PersonButton } from "@/components/PersonSheet";
import RewardBanner from "@/components/RewardBanner";
import { ArrowDownIcon, ArrowUpIcon, ChevronRight } from "@/components/icons";
import { requireUser } from "@/lib/session";
import { getRank, getSnapshotPosition } from "@/lib/ranking";
import { getAnnouncement, getPublicStats, track } from "@/lib/stats";
import { checkAutoBadges, getProfileSteps, getUserBadges, isVerified, topBadge } from "@/lib/badges";
import type { BadgeInfo } from "@/lib/badge-meta";
import { getStandings, weekStart } from "@/lib/league";
import { getQuizStatus } from "@/lib/quiz";
import { getStreak } from "@/lib/streaks";
import { vapidPublicKey } from "@/lib/push";
import PushPrompt from "@/components/PushPrompt";
import { StreakChip, StreakProvider } from "@/components/Streak";
import { sql } from "@/lib/db";
import { formatNumber, lagosDate, nextLagosMidnight } from "@/lib/util";
import { stateSlug } from "@/lib/states";
import QuizCard from "./QuizCard";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser();
  const { welcome } = await searchParams;
  const today = lagosDate();

  // Auto badges are checked on every Home visit (cheap and idempotent), then read back.
  const badgesReady = checkAutoBadges(user.id);
  const [rank, stats, announcement, snapshot, newcomers, steps, badges, myRewards, quiz, streak, standings] = await Promise.all([
    getRank(user.id),
    getPublicStats(),
    getAnnouncement(),
    getSnapshotPosition(user.id, today),
    sql<{ id: string; nickname: string; photo_version: number; top_badge: BadgeInfo | null; verified: boolean }[]>`
      SELECT u.id, u.nickname, u.photo_version, ${topBadge()}, ${isVerified()} FROM users u
      WHERE u.state = ${user.state} AND u.id <> ${user.id} AND u.completed_at IS NOT NULL
        AND NOT u.is_banned AND u.show_in_list
      ORDER BY u.completed_at DESC LIMIT 5
    `,
    badgesReady.then(() => getProfileSteps(user.id)),
    badgesReady.then(() => getUserBadges(user.id)),
    // Rewards waiting for the user (no payout details here).
    sql<{ id: string; status: "hidden" | "unclaimed"; amount_ngn: number | null }[]>`
      SELECT id, status, amount_ngn FROM rewards WHERE user_id = ${user.id} AND status IN ('hidden', 'unclaimed')
    `,
    getQuizStatus(user.id),
    getStreak(user.id),
    getStandings(weekStart(today)),
  ]);
  const unclaimed = myRewards.filter((r) => r.status === "unclaimed");
  const profileComplete = badges.find((b) => b.slug === "profile_complete");

  const position = rank?.position ?? 0;
  const change = snapshot ? snapshot - position : 0;
  const myState = stats.states.find((s) => s.state === user.state);
  const standing = standings.find((s) => s.state === user.state);
  const above = standing?.rank ? standings.find((s) => s.rank === standing.rank! - 1) : undefined;

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

  return (
    <StreakProvider initial={streak}>
      <Confetti fire={celebrate} />
      {profileComplete && (
        <BadgeCelebration slug="profile_complete" name="Profile Complete" awardedAt={new Date(profileComplete.awarded_at).toISOString()} />
      )}
      <header className="flex h-11 items-center justify-between">
        <h1 className="h-display min-w-0 truncate text-2xl">Hi, {user.nickname}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <StreakChip />
          {position > 0 && (
            <Link
              href="/invite"
              aria-label={`Your position: ${position}. Invite friends to move up`}
              className="flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm font-bold text-lime-ink"
            >
              #{formatNumber(position)}
              {change !== 0 && (
                <span className={`flex items-center text-[12px] ${change > 0 ? "" : "text-muted"}`}>
                  {change > 0 ? <ArrowUpIcon size={12} strokeWidth={2.5} /> : <ArrowDownIcon size={12} strokeWidth={2.5} />}
                  {Math.abs(change)}
                </span>
              )}
            </Link>
          )}
          <Link href="/profile" aria-label="Your profile">
            <Avatar id={user.id} nickname={user.nickname} photoVersion={user.photo_version} size={40} />
          </Link>
        </div>
      </header>

      <RewardBanner
        unclaimedIds={unclaimed.map((r) => r.id)}
        unclaimedTotal={unclaimed.reduce((s, r) => s + (r.amount_ngn ?? 0), 0)}
        hiddenCount={myRewards.length - unclaimed.length}
        underReview={user.is_flagged}
      />

      <QuizCard status={quiz} streak={streak} state={user.state ?? "your state"} standing={standing} above={above} nextAt={nextLagosMidnight()} />

      {vapidPublicKey && <PushPrompt publicKey={vapidPublicKey} />}

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
                  {n.verified && <VerifiedBadge size={14} />}
                  <BadgeIcon badge={n.top_badge} size={14} />
                </span>
              </PersonButton>
            ))}
          </div>
        </section>
      )}

      <ComingSoon layout="tiles" state={user.state} />
    </StreakProvider>
  );
}
