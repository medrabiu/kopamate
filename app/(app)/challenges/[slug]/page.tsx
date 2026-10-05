import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import Countdown from "@/components/Countdown";
import FollowButtons from "@/components/challenges/FollowButtons";
import { ChevronLeft } from "@/components/icons";
import { requireUser } from "@/lib/session";
import { getChallenge, getMyEntries, getParticipant, getPool, getPublicWinners, isOpen, lines, countsTowardLimit } from "@/lib/challenges";
import { formatNgn } from "@/lib/reward-meta";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getChallenge((await params).slug);
  return { title: c?.title ?? "Challenge" };
}

const WHEN = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

export default async function ChallengePage({ params }: Props) {
  const user = await requireUser();
  const c = await getChallenge((await params).slug);
  if (!c) notFound();
  const [{ pool, next, prizes, approved }, participant, entries, winners] = await Promise.all([
    getPool(c),
    getParticipant(c.id, user.id),
    getMyEntries(c.id, user.id),
    c.published_at ? getPublicWinners(c.id) : Promise.resolve([]),
  ]);
  const open = isOpen(c);
  const used = entries.filter(countsTowardLimit).length;
  const upcoming = c.status === "upcoming" || (c.opens_at && c.opens_at.getTime() > Date.now());
  const label = Object.fromEntries(c.prize_split.map((p) => [p.key, p.label]));

  let cta: { href: string; text: string } | null = null;
  if (c.status === "open" || c.status === "upcoming") {
    if (!participant) cta = { href: `/challenges/${c.slug}/join`, text: upcoming ? "Get in early" : "Enter now" };
    else if (open && used < c.max_entries_per_user) cta = { href: `/challenges/${c.slug}/mine`, text: `You're in · Submit entry ${used + 1} of ${c.max_entries_per_user}` };
    else cta = { href: `/challenges/${c.slug}/mine`, text: "You're in · My entries" };
  } else if (participant) {
    cta = { href: `/challenges/${c.slug}/mine`, text: "My entries" };
  }

  return (
    <>
      <Link href="/challenges" className="-mb-2 flex items-center gap-1 self-start text-sm font-medium text-muted">
        <ChevronLeft size={16} /> Challenges
      </Link>

      {/* Hero: live pool and countdown */}
      <section className="relative flex flex-col gap-4 overflow-hidden rounded-3xl bg-pink p-5 text-on-accent">
        <span className="absolute -top-12 -right-12 size-44 rounded-full bg-lime/40 blur-2xl" aria-hidden="true" />
        <h1 className="h-display relative text-[26px] leading-tight">{c.title}</h1>
        <div className="relative">
          <p className="text-sm font-medium opacity-80">{c.status === "results" ? "Prize pool" : "Prize pool right now"}</p>
          <p className="h-display text-[44px] leading-none">{formatNgn(pool)}</p>
          {next && c.status !== "results" && c.status !== "closed" && (
            <div className="mt-3 flex flex-col gap-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-on-accent/15" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-on-accent"
                  style={{ width: `${Math.max(4, ((c.pool_step_entries - next.entries) / c.pool_step_entries) * 100)}%` }}
                />
              </div>
              <p className="text-sm font-bold">
                {next.entries} more {next.entries === 1 ? "entry" : "entries"} adds {formatNgn(next.amount)} · up to {formatNgn(c.pool_cap)}
              </p>
            </div>
          )}
        </div>
        <p className="relative text-sm font-bold">
          {c.status === "results"
            ? "Winners announced"
            : c.status === "closed"
              ? "Entries are closed. Winners coming soon."
              : upcoming && c.opens_at
                ? <>Opens in <Countdown to={c.opens_at.toISOString()} after="now" /></>
                : c.closes_at
                  ? <>Ends in <Countdown to={c.closes_at.toISOString()} after="now" /> · {approved} {approved === 1 ? "entry" : "entries"}</>
                  : "Dates coming soon"}
        </p>
      </section>

      {cta && (
        <Link href={cta.href} className="btn-primary">
          {cta.text}
        </Link>
      )}

      {winners.length > 0 && (
        <section className="card flex flex-col gap-3" aria-labelledby="winners-title">
          <h2 id="winners-title" className="h-display text-xl">
            Winners 🏆
          </h2>
          <ul className="flex flex-col divide-y divide-line">
            {c.prize_split
              .map((p) => winners.find((w) => w.prize_key === p.key))
              .filter((w) => w !== undefined)
              .map((w) => (
                <li key={w.prize_key} className="flex items-center gap-3 py-2.5">
                  <Avatar id={w.user_id} nickname={w.nickname} photoVersion={w.photo_version} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{w.nickname}</span>
                    <span className="block text-sm text-muted">
                      {label[w.prize_key] ?? w.prize_key}
                      {w.state ? ` · ${w.state}` : ""}
                    </span>
                  </span>
                  <span className="h-display shrink-0">{formatNgn(w.amount_ngn)}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2" aria-labelledby="brief-title">
        <h2 id="brief-title" className="h-display text-xl">
          The brief
        </h2>
        {lines(c.brief).map((l) => (
          <p key={l} className="leading-relaxed text-muted">
            {l}
          </p>
        ))}
        {c.hashtag && <p className="text-sm text-muted">Tip: add {c.hashtag} if you like. It&apos;s optional.</p>}
      </section>

      {lines(c.ideas).length > 0 && (
        <section className="flex flex-col gap-2.5" aria-labelledby="ideas-title">
          <h2 id="ideas-title" className="h-display text-xl">
            Ideas to get you started
          </h2>
          <ul className="flex flex-col gap-2">
            {lines(c.ideas).map((l) => (
              <li key={l} className="rounded-2xl border border-line px-4 py-3 text-[15px]">
                💡 {l}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="enter-title">
        <h2 id="enter-title" className="h-display text-xl">
          How to enter
        </h2>
        <ol className="flex flex-col gap-2.5">
          {[
            ["Get verified", "Your Kopamate account must be verified. It's in your Profile."],
            ["Follow us", "On X, plus TikTok or Instagram if you post there, and join our WhatsApp Channel."],
            ["Make and post", `Tag ${c.required_tags.x ?? "@kopamate"} and put your entry's Kopamate link in the caption or bio.`],
            ["Add your post link", `Up to ${c.max_entries_per_user} entries. More entries, more chances.`],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="h-display grid size-8 shrink-0 place-items-center rounded-full bg-lime text-sm text-on-accent">{i + 1}</span>
              <span>
                <span className="block font-bold">{t}</span>
                <span className="block text-sm text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <FollowButtons links={c.social_links} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="prizes-title">
        <h2 id="prizes-title" className="h-display text-xl">
          Prizes
        </h2>
        <ul className="divide-y divide-line rounded-3xl border border-line">
          {prizes.map((p, i) => (
            <li key={p.key} className="flex items-center gap-3 px-4 py-3">
              <span className="w-7 text-center text-lg">{["🥇", "🥈", "🥉"][i] ?? "⭐"}</span>
              <span className="flex-1 font-medium">{p.label}</span>
              <span className="text-sm text-muted">{p.pct}%</span>
              <span className="h-display w-24 text-right">{formatNgn(p.amount)}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          Amounts are shares of the final pool. One prize per person. Winners are chosen by the Kopamate team based on the people you bring to
          Kopamate, your post&apos;s reach, and the quality of your content.
        </p>
      </section>

      <details className="card group" id="rules">
        <summary className="flex cursor-pointer list-none items-center justify-between font-bold [&::-webkit-details-marker]:hidden">
          Rules
          <span aria-hidden="true" className="text-xl leading-none text-muted transition-transform group-open:rotate-45">
            +
          </span>
        </summary>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted">
          {lines(c.rules).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {(c.opens_at || c.closes_at) && (
          <p className="mt-3 text-sm text-muted">
            {c.opens_at && `Opens ${WHEN.format(c.opens_at)}. `}
            {c.closes_at && `Closes ${WHEN.format(c.closes_at)} (Lagos time).`}
          </p>
        )}
      </details>
    </>
  );
}
