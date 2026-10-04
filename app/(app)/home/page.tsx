import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import Avatar from "@/components/Avatar";
import BadgeCelebration from "@/components/BadgeCelebration";
import VerifiedBadge from "@/components/VerifiedBadge";
import ComingSoon from "@/components/ComingSoon";
import Confetti from "@/components/Confetti";
import { PersonButton } from "@/components/PersonSheet";
import RewardBanner from "@/components/RewardBanner";
import AnnouncementCard from "@/components/AnnouncementCard";
import Carousel from "@/components/Carousel";
import { BellIcon, ChevronRight } from "@/components/icons";
import { requireUser } from "@/lib/session";
import { getRank } from "@/lib/ranking";
import { getPublicStats, track } from "@/lib/stats";
import { getAnnouncements, getUnreadCount } from "@/lib/notifications";
import { checkAutoBadges, getProfileSteps, getUserBadges, isVerified } from "@/lib/badges";
import { getStandings, weekStart } from "@/lib/league";
import { getQuizStatus } from "@/lib/quiz";
import { getStreak } from "@/lib/streaks";
import { vapidPublicKey } from "@/lib/push";
import SetupCard from "@/components/SetupCard";
import { StreakChip, StreakProvider } from "@/components/Streak";
import { sql } from "@/lib/db";
import { formatNumber, lagosDate, nextLagosMidnight } from "@/lib/util";
import { stateSlug } from "@/lib/states";
import QuizCard from "./QuizCard";
import { ConfirmStageCard } from "@/components/NyscStatusForm";
import HustleHomeCard from "@/components/hustle/HustleHomeCard";
import { hustleOpenTo } from "@/lib/hustle/access";
import { getHustleSettings } from "@/lib/hustle/settings";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser();
  const { welcome } = await searchParams;
  const today = lagosDate();

  // Auto badges are checked on every Home visit (cheap and idempotent), then read back.
  const badgesReady = checkAutoBadges(user.id);
  const [rank, stats, announcements, newcomers, steps, badges, myRewards, quiz, streak, standings, unread] = await Promise.all([
    getRank(user.id),
    getPublicStats(),
    getAnnouncements(20),
    sql<{ id: string; nickname: string; photo_version: number; verified: boolean }[]>`
      SELECT u.id, u.nickname, u.photo_version, ${isVerified()} FROM users u
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
    getUnreadCount(user.id),
  ]);
  const hustleSettings = await getHustleSettings();
  const hustle = hustleOpenTo(user, hustleSettings.enabled);
  // The carousel: the last 30 days of announcements, pinned ones first, then newest.
  const monthAgo = Date.now() - 30 * 86_400_000;
  const slides = announcements
    .filter((a) => a.pinned || new Date(a.published_at).getTime() > monthAgo)
    .sort((x, y) => Number(y.pinned) - Number(x.pinned))
    .slice(0, 6);
  const unclaimed = myRewards.filter((r) => r.status === "unclaimed");
  const profileComplete = badges.find((b) => b.slug === "profile_complete");

  const position = rank?.position ?? 0;
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

  const quizFirst = quiz.kind === "ready" || quiz.kind === "playing";
  const quizCard = (
    <QuizCard status={quiz} streak={streak} state={user.state ?? "your state"} standing={standing} above={above} nextAt={nextLagosMidnight()} />
  );
  const news =
    slides.length > 0 ? (
      <Carousel label="Updates from the Kopamate team">
        {slides.map((a) => (
          <AnnouncementCard key={a.id} a={a} slide />
        ))}
      </Carousel>
    ) : null;

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
          {/* Prefetched in full while Home is open, so the bell opens instantly instead of on a loading screen. */}
          <Link
            href="/notifications"
            prefetch
            aria-label={unread > 0 ? `Notifications, ${unread} new` : "Notifications"}
            className="relative flex size-10 items-center justify-center rounded-full border border-line"
          >
            <BellIcon size={20} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pink px-1 text-[11px] font-bold text-on-accent">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
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

      {!user.stage_confirmed_at && (
        <ConfirmStageCard stage={user.nysc_stage} batch={user.nysc_batch} state={user.state} canPickState={false} />
      )}

      {/* Before today's quiz is played it leads the page; once it's done (or there's none), the news comes first. */}
      {quizFirst && quizCard}
      {news}
      {!quizFirst && quizCard}

      {hustle && <HustleHomeCard userId={user.id} grant={hustleSettings.grant} />}

      <SetupCard steps={steps} publicKey={vapidPublicKey} />

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
                </span>
              </PersonButton>
            ))}
          </div>
        </section>
      )}

      <ComingSoon state={user.state} />
    </StreakProvider>
  );
}
