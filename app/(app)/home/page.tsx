import type { Metadata } from "next";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import ComingSoon from "@/components/ComingSoon";
import Confetti from "@/components/Confetti";
import CountUp from "@/components/CountUp";
import HomeCarousel from "@/components/HomeCarousel";
import PrizeCard from "@/components/PrizeCard";
import ShareButtons from "@/components/ShareButtons";
import StatusCardButton from "@/components/StatusCardButton";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/icons";
import { requireUser } from "@/lib/session";
import { getRank, getSnapshotPosition, nextGoal } from "@/lib/ranking";
import { getAnnouncement, getPrizeText, getPublicStats, track } from "@/lib/stats";
import { referralLink, shareMessage, whatsappShareUrl } from "@/lib/config";
import { sql } from "@/lib/db";
import { formatNumber, lagosDate } from "@/lib/util";
import { stateSlug } from "@/lib/states";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser();
  const { welcome } = await searchParams;
  const today = lagosDate();

  const [rank, stats, prizeText, announcement, snapshot, newcomers] = await Promise.all([
    getRank(user.id),
    getPublicStats(),
    getPrizeText(),
    getAnnouncement(),
    getSnapshotPosition(user.id, today),
    sql<{ id: string; nickname: string; photo_version: number }[]>`
      SELECT id, nickname, photo_version FROM users
      WHERE state = ${user.state} AND id <> ${user.id} AND completed_at IS NOT NULL
        AND NOT is_banned AND show_in_list
      ORDER BY completed_at DESC LIMIT 5
    `,
  ]);

  const position = rank?.position ?? 0;
  const refs = rank?.refs ?? 0;
  const change = snapshot ? snapshot - position : 0;
  const goal = nextGoal(position);
  const myState = stats.states.find((s) => s.state === user.state);

  // Celebrate new sign-ups and any climb since the last visit.
  const improved = user.last_seen_position !== null && position > 0 && position < user.last_seen_position;
  const celebrate = welcome === "1" || improved;
  if (user.last_seen_on !== today || user.last_seen_position !== position) {
    // Run both writes together: one database round trip instead of two.
    await Promise.all([
      sql`UPDATE users SET last_seen_on = ${today}::date, last_seen_position = ${position} WHERE id = ${user.id}`,
      user.last_seen_on !== today ? track("daily_return", user.id) : null,
    ]);
  }

  return (
    <>
      <Confetti fire={celebrate} />
      <header className="flex h-11 items-center justify-between">
        <h1 className="h-display text-2xl">Hi, {user.nickname}</h1>
        <Link href="/profile" aria-label="Your profile">
          <Avatar id={user.id} nickname={user.nickname} photoVersion={user.photo_version} size={40} />
        </Link>
      </header>

      <HomeCarousel labels={["Your position", "Post your spot", ...(announcement ? [announcement.title] : [])]}>
        <div className="card flex w-full flex-col gap-3.5 !p-[22px]">
          <div className="text-sm text-muted">Your position</div>
          <div className="flex items-end justify-between gap-3">
            <div className="h-display text-[72px] leading-[0.9] text-lime-ink">
              <CountUp to={position} from={improved && user.last_seen_position ? user.last_seen_position : position} prefix="#" />
            </div>
            {change > 0 && (
              <div className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1.5 text-[13px] font-bold text-lime-ink">
                <ArrowUpIcon size={14} strokeWidth={2.5} />
                {change} since yesterday
              </div>
            )}
            {change < 0 && (
              <div className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1.5 text-[13px] font-bold text-muted">
                <ArrowDownIcon size={14} strokeWidth={2.5} />
                {Math.abs(change)} since yesterday
              </div>
            )}
          </div>

          {goal ? (
            <div className="flex flex-col gap-2">
              <div className="h-2 rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(goal.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-2 rounded-full bg-lime" style={{ width: `${Math.max(4, goal.progress * 100)}%` }} />
              </div>
              <p className="text-sm">
                Invite <span className="font-bold">{goal.invites} more</span> to reach the top {goal.target}
              </p>
            </div>
          ) : (
            <p className="text-sm font-bold text-lime-ink">You&apos;re in the top 10. Keep inviting to stay there.</p>
          )}

          <ShareButtons
            variant="compact"
            link={referralLink(user.referral_code)}
            whatsappUrl={whatsappShareUrl(user.referral_code)}
            message={shareMessage(user.referral_code)}
          />
          <p className="text-sm text-muted">
            {refs === 0 ? "No friends have joined with your link yet" : `${refs} ${refs === 1 ? "friend" : "friends"} joined with your link`}
          </p>
        </div>

        <div className="card flex w-full gap-4 !p-[22px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/card/${user.referral_code}`}
            alt={`Status card: I'm #${formatNumber(position)} on Kopamate`}
            width={108}
            height={192}
            loading="lazy"
            className="aspect-[9/16] w-[108px] shrink-0 self-start rounded-xl bg-bg object-cover"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h2 className="h-display text-xl leading-tight">Post your spot</h2>
            <p className="text-sm leading-normal text-muted">
              A WhatsApp Status card with your position and your link. It updates as you climb.
            </p>
            <div className="mt-auto">
              <StatusCardButton
                cardUrl={`/card/${user.referral_code}`}
                message={shareMessage(user.referral_code)}
                fileName={`kopamate-${user.referral_code}.png`}
              />
            </div>
          </div>
        </div>

        {announcement && (
          <div className="flex w-full flex-col gap-2 rounded-3xl bg-pink p-[22px] text-on-accent">
            <h2 className="h-display text-[26px] leading-tight">{announcement.title}</h2>
            {announcement.body && <p className="text-[15px] font-medium leading-normal">{announcement.body}</p>}
            {announcement.buttonLabel && announcement.buttonUrl && (
              <a
                href={announcement.buttonUrl}
                {...(announcement.buttonUrl.startsWith("https://") ? { target: "_blank", rel: "noopener" } : {})}
                className="mt-auto flex h-12 items-center justify-center self-start rounded-full bg-on-accent px-6 text-[15px] font-bold text-pink"
              >
                {announcement.buttonLabel}
              </a>
            )}
          </div>
        )}
      </HomeCarousel>

      <section className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-[20px] bg-surface p-4">
          <span className="text-[13px] text-muted">Corpers joined</span>
          <span className="h-display text-[28px]">{formatNumber(stats.total)}</span>
        </div>
        <Link href={`/corpers/${stateSlug(user.state ?? "")}`} className="flex flex-col gap-1 rounded-[20px] bg-surface p-4">
          <span className="text-[13px] text-muted">{user.state} is</span>
          <span className="h-display text-[28px]">
            <span className="text-pink-ink">#{myState?.rank ?? "–"}</span> · {formatNumber(myState?.count ?? 0)}
          </span>
        </Link>
      </section>

      {newcomers.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="h-display text-xl">New from {user.state}</h2>
            <Link href={`/corpers/${stateSlug(user.state ?? "")}`} className="py-2 text-sm font-medium text-lime-ink">
              See all
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto">
            {newcomers.map((n) => (
              <div key={n.id} className="flex w-[56px] shrink-0 flex-col items-center gap-1.5">
                <Avatar id={n.id} nickname={n.nickname} photoVersion={n.photo_version} size={52} />
                <span className="w-full truncate text-center text-xs text-muted">{n.nickname}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <ComingSoon layout="rows" state={user.state} />
      <PrizeCard text={prizeText} href="/rewards" />
    </>
  );
}
