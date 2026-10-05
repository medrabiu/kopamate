import Link from "next/link";
import Avatar from "./Avatar";
import CountUp from "./CountUp";
import Countdown from "./Countdown";
import EarlyCorperBanner from "./EarlyCorperBanner";
import { CheckIcon, LockIcon, ShieldIcon } from "./icons";
import { LogoMark } from "./Logo";
import RotatingWord from "./landing/RotatingWord";
import StickyJoin from "./landing/StickyJoin";
import TryQuiz from "./landing/TryQuiz";
import { APP_NAME, APP_URL, SITE_DESCRIPTION } from "@/lib/config";
import { STATES } from "@/lib/states";
import type { PublicStats } from "@/lib/stats";
import { formatNumber } from "@/lib/util";

export type LandingLeague = {
  /** Ranked states, best first. */
  states: { state: string; score: number; players: number }[];
  /** When this League week ends (ISO). */
  endsAt: string;
};

type Props = {
  stats: PublicStats;
  earlyDeadline: string;
  league: LandingLeague | null;
  /** Who sent the invite link, on /r/[code]. */
  inviter?: { id: string; nickname: string; photo_version: number } | null;
};

/** Shown on the page and given to search engines as FAQ structured data, so both always match. */
const FAQ = [
  {
    q: `What is ${APP_NAME}?`,
    a: `${APP_NAME} is a free app for NYSC corps members across Nigeria. You can play the Daily Quiz for your state, find corpers serving near you, earn badges for your service year, and win prizes made for corpers.`,
  },
  {
    q: "What is the Daily Quiz?",
    a: "Five new questions every day about NYSC, Nigeria, sports and more, with 15 seconds each. Right answers and speed earn points, playing every day builds a streak, and every point counts for your state in the weekly State League.",
  },
  {
    q: `Is ${APP_NAME} an official NYSC app?`,
    a: `No. ${APP_NAME} is an independent app for corps members and is not affiliated with the National Youth Service Corps.`,
  },
  { q: `Is ${APP_NAME} free?`, a: "Yes. Signing up and using the app is free." },
  {
    q: "Who can join?",
    a: "Prospective corps members waiting for call-up, corpers serving in any of Nigeria's 36 states and the FCT, and ex-corpers who have passed out. Sign up with your phone number or Google in about 20 seconds.",
  },
  {
    q: "How do prizes work?",
    a: "When you win, the reward shows up in the app. You claim it there and get it as a bank transfer, airtime or data. Only verified corpers can win.",
  },
  {
    q: "How do I get verified?",
    a: "Add your state code and a photo of your NYSC ID card in your profile. Our team checks it and deletes the photo once it's done.",
  },
  {
    q: "Can other people see my phone number?",
    a: "No. Other corpers only see your username, photo, state, position and badges. Your phone number, email and state code stay private.",
  },
];

/** Organization, WebSite, WebApplication and FAQ structured data for search results. */
function structuredData() {
  const org = { "@type": "Organization", "@id": `${APP_URL}/#org`, name: APP_NAME, url: APP_URL, logo: `${APP_URL}/icons/512` };
  return {
    "@context": "https://schema.org",
    "@graph": [
      org,
      { "@type": "WebSite", "@id": `${APP_URL}/#website`, name: APP_NAME, url: APP_URL, description: SITE_DESCRIPTION, inLanguage: "en-NG", publisher: { "@id": org["@id"] } },
      {
        "@type": "WebApplication",
        name: APP_NAME,
        url: APP_URL,
        description: SITE_DESCRIPTION,
        applicationCategory: "SocialNetworkingApplication",
        operatingSystem: "Web, Android, iOS",
        browserRequirements: "Requires a modern web browser",
        audience: { "@type": "Audience", audienceType: "NYSC corps members", geographicArea: { "@type": "Country", name: "Nigeria" } },
        offers: { "@type": "Offer", price: "0", priceCurrency: "NGN" },
        publisher: { "@id": org["@id"] },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      },
    ],
  };
}

const STEPS = [
  { title: "Sign up in 20 seconds", text: "With your phone number or Google. Free." },
  { title: "Tell us your stage", text: "Awaiting call-up, serving or passed out, plus your state once you have one." },
  { title: "Play and climb", text: "Take the Daily Quiz, keep your streak and carry your state up the League." },
];

const TRUST = [
  { Icon: LockIcon, text: "Your phone number is never shown to anyone." },
  { Icon: ShieldIcon, text: "Prizes go to verified corpers only, checked by ID." },
  { Icon: CheckIcon, text: "Hide yourself from lists or delete your account any time." },
];

const HERO_WORDS = ["Play the Daily Quiz.", "Carry your state.", "Find your people.", "Win real prizes."];

/** A pretend Home screen in a phone frame, for the hero. Decorative only. */
function PhoneMock({ title, top }: { title: string; top: { state: string; value: string }[] }) {
  return (
    <div className="relative mx-auto w-full max-w-[300px]" aria-hidden="true">
      <div className="glow-drift absolute -top-10 -left-10 size-56 rounded-full bg-lime/25 blur-3xl" />
      <div className="glow-drift absolute -right-8 -bottom-8 size-56 rounded-full bg-pink/25 blur-3xl [animation-delay:-6s]" />

      <div className="relative rounded-[44px] border border-line bg-bg p-3 shadow-[0_30px_80px_rgb(0_0_0/0.35)]">
        <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-surface-2" />
        <div className="flex flex-col gap-2.5 px-1 pb-2">
          <div className="flex items-center justify-between">
            <span className="h-display text-lg">Home</span>
            <span className="rounded-full border border-line px-2.5 py-1 text-xs font-bold">🔥 12</span>
          </div>

          <div className="rounded-2xl bg-lime p-3.5 text-on-accent">
            <p className="text-[11px] font-bold tracking-wide uppercase opacity-70">Daily Quiz</p>
            <p className="h-display mt-0.5 text-[17px] leading-tight">5 new questions are ready</p>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-xs font-medium opacity-75">15s each · for your state</span>
              <span className="rounded-full bg-on-accent px-3 py-1 text-xs font-bold text-lime">Play</span>
            </div>
          </div>

          {top.length >= 3 && (
          <div className="rounded-2xl border border-line p-3">
            <p className="mb-2 text-xs font-bold">{title}</p>
            <ol className="flex flex-col gap-1.5 text-xs">
              {top.slice(0, 3).map((s, i) => (
                <li key={s.state} className="flex items-center gap-2">
                  <span>{["🥇", "🥈", "🥉"][i]}</span>
                  <span className="flex-1 truncate font-medium">{s.state}</span>
                  <span className="font-bold tabular-nums">{s.value}</span>
                </li>
              ))}
            </ol>
          </div>
          )}

          <div className="flex items-center gap-2.5 rounded-2xl border border-line p-3">
            <span className="flex">
              {["#8B7BFF", "#FF4FA3", "#FFB547", "#4FD1C5"].map((c, i) => (
                <span key={c} className={`size-7 rounded-full ring-2 ring-bg ${i ? "-ml-2" : ""}`} style={{ background: c }} />
              ))}
            </span>
            <span className="text-xs leading-snug">
              <span className="font-bold">Corpers near you</span>
              <span className="block text-muted">Tap to see who&apos;s serving</span>
            </span>
          </div>
        </div>
      </div>

      <span className="float-y absolute -top-4 -left-6 rounded-full border border-line bg-bg px-3 py-1.5 text-sm font-bold text-lime-ink shadow-lg">
        +142 pts
      </span>
      <span className="float-y absolute -top-4 -right-6 rounded-full border border-line bg-bg px-3 py-1.5 text-sm font-bold shadow-lg [animation-delay:-1.5s]">
        🔥 12-day streak
      </span>
      <span className="float-y absolute -bottom-5 left-2 rounded-full bg-pink px-3 py-1.5 text-sm font-bold text-on-accent shadow-lg [animation-delay:-3s]">
        🏆 #1 this week
      </span>
    </div>
  );
}

/** Small decorative art for each feature tile. */
const FEATURES: { title: string; text: string; art: React.ReactNode; wide?: boolean; soon?: boolean }[] = [
  {
    title: "The Daily Quiz",
    text: "Five new questions every day on NYSC, Nigeria, sports and more. Be right, be quick, and every point counts for your state.",
    wide: true,
    art: (
      <div className="flex gap-2">
        {["🟩", "🟩", "🟥", "🟩", "🟩"].map((m, i) => (
          <span key={i} className="float-y text-2xl" style={{ animationDelay: `${i * -0.6}s` }}>
            {m}
          </span>
        ))}
      </div>
    ),
  },
  {
    title: "Streaks",
    text: "Play every day to grow your streak and earn bonus points. Miss a day and a freeze can cover you.",
    art: (
      <div className="flex items-end gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <span key={d} className={`size-5 rounded-md ${d < 7 ? "bg-lime" : "border-2 border-dashed border-lime"}`} />
        ))}
        <span className="ml-1 text-2xl leading-none">🔥</span>
      </div>
    ),
  },
  {
    title: "State League",
    text: "Every week, states battle on quiz points per corper. A small state that plays hard can beat a big one.",
    art: (
      <div className="flex h-10 items-end gap-1.5">
        {[90, 70, 55, 40, 28].map((h, i) => (
          <span key={h} className={`w-5 rounded-t-md ${i === 0 ? "bg-pink" : "bg-surface-2"}`} style={{ height: `${h}%` }} />
        ))}
      </div>
    ),
  },
  {
    title: "Find corpers in your state",
    wide: true,
    text: "See who's serving where across all 36 states and the FCT. Follow people and tap anyone to see their profile.",
    art: (
      <div className="flex">
        {["#8B7BFF", "#FF4FA3", "#FFB547", "#4FD1C5", "#C6F432"].map((c, i) => (
          <span key={c} className={`size-9 rounded-full ring-2 ring-bg ${i ? "-ml-2.5" : ""}`} style={{ background: c }} />
        ))}
      </div>
    ),
  },
  {
    title: "Badges and real prizes",
    text: "Earn badges for your service year. Verified corpers win cash, airtime and data, paid straight to them.",
    art: (
      <div className="flex flex-wrap gap-2 text-sm font-bold">
        <span className="rounded-full bg-lime px-3 py-1 text-on-accent">🏅 Early Corper</span>
        <span className="rounded-full bg-pink px-3 py-1 text-on-accent">👑 Quiz MVP</span>
        <span className="rounded-full border border-line px-3 py-1">🏆 Champion State</span>
      </div>
    ),
  },
  {
    title: "Gigs and competitions",
    text: "Gig competitions, contests like Best Khaki Drip and Corper of the Month, and jobs and remote gigs for corpers and ex-corpers.",
    wide: true,
    soon: true,
    art: (
      <div className="flex flex-wrap gap-2 text-sm font-bold">
        <span className="rounded-full border border-line px-3 py-1">💼 Gigs</span>
        <span className="rounded-full border border-line px-3 py-1">📸 Best Khaki Drip</span>
        <span className="rounded-full border border-line px-3 py-1">⭐ Corper of the Month</span>
        <span className="rounded-full border border-line px-3 py-1">🧑‍💻 Remote jobs</span>
      </div>
    ),
  },
];

/** Everyone in NYSC, at any stage, matching the stages people pick in the app (lib/nysc.ts). */
const AUDIENCE = [
  { emoji: "⏳", title: "Prospective corpers", text: "Waiting for call-up? Get to know NYSC life and other corpers before camp, and start playing the Daily Quiz." },
  { emoji: "🪖", title: "Serving corpers", text: "Play for your state, find corpers serving in it and win prizes during your service year." },
  { emoji: "🎓", title: "Ex-corpers", text: "Passed out? Stay connected with corpers you met and keep playing, with jobs and gigs on the way." },
];

/** The public landing page at / (and invite links). Logged-in users never see it. */
export default function Landing({ stats, earlyDeadline, league, inviter }: Props) {
  const joined = stats.states.filter((s) => s.count > 0);
  // The League table when this week has scores, otherwise the states with the most corpers.
  const showLeague = league && league.states.length >= 3 && league.states[0].score > 0;
  const board = showLeague
    ? league.states.slice(0, 5).map((s) => ({ state: s.state, value: s.score.toFixed(1), raw: s.score, sub: `${formatNumber(s.players)} playing` }))
    : joined.slice(0, 5).map((s) => ({ state: s.state, value: formatNumber(s.count), raw: s.count, sub: "corpers" }));
  const max = Math.max(1, ...board.map((s) => s.raw));
  const metrics: [number, string][] = [
    [stats.total, "corpers joined"],
    [stats.activeStates, `of ${STATES.length} states`],
    [stats.today, "joined today"],
    [stats.verified, "verified corpers"],
  ];

  return (
    <div className="min-h-screen-safe overflow-x-clip">
      <script
        type="application/ld+json"
        // JSON with "<" escaped, so nothing in it can close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, "\\u003c") }}
      />
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1040px] items-center justify-between px-5">
          <span className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <span className="h-display text-xl">{APP_NAME}</span>
          </span>
          <nav className="flex items-center gap-1.5">
            <a href="#try" className="hidden rounded-full px-3.5 py-2 text-[15px] font-bold hover:bg-surface-2 sm:block">
              Try the quiz
            </a>
            <Link href="/login" className="rounded-full px-3.5 py-2 text-[15px] font-bold hover:bg-surface-2">
              Log in
            </Link>
            <Link href="/join" className="rounded-full bg-lime px-4 py-2 text-[15px] font-bold text-on-accent transition-transform hover:scale-105">
              Join
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1040px] flex-col gap-16 px-5 pt-8 pb-28 md:gap-24 md:pt-16 md:pb-12">
        {/* Hero */}
        <section className="grid items-center gap-12 md:grid-cols-[1.15fr_1fr] md:gap-12">
          <div className="flex flex-col gap-5">
            {inviter ? (
              <span className="quiz-rise flex items-center gap-2.5 self-start rounded-full border border-lime py-1 pr-4 pl-1 text-sm">
                <Avatar id={inviter.id} nickname={inviter.nickname} photoVersion={inviter.photo_version} size={28} />
                <span>
                  <span className="font-bold">{inviter.nickname}</span> invited you
                </span>
              </span>
            ) : (
              <span className="quiz-rise flex items-center gap-2 self-start rounded-full border border-line px-3 py-1.5 text-[13px] font-medium text-muted">
                <span className="size-2 animate-pulse rounded-full bg-lime" />
                {stats.today > 0
                  ? `${formatNumber(stats.today)} ${stats.today === 1 ? "corper" : "corpers"} joined today`
                  : "Free for every corps member in Nigeria"}
              </span>
            )}
            <h1 className="h-display quiz-rise text-[40px] leading-[1.05] [animation-delay:80ms] md:text-[58px]">
              The home for every NYSC corper in Nigeria.
              <span className="mt-1 block min-h-[1.1em] text-lime-ink">
                <RotatingWord words={HERO_WORDS} />
              </span>
            </h1>
            <p className="quiz-rise max-w-[34rem] text-[17px] leading-relaxed text-muted [animation-delay:160ms]">
              Play a 5-question quiz every day, carry your state up the weekly League, meet corpers serving near you and win
              prizes made for corpers.
            </p>
            <div id="hero-cta" className="quiz-rise flex flex-col gap-2.5 [animation-delay:240ms] sm:flex-row">
              <Link href="/join" className="btn-primary h-13 shadow-[0_8px_30px_rgb(198_244_50/0.35)] transition-transform hover:-translate-y-0.5 sm:w-auto sm:px-8">
                Join free
              </Link>
              <a href="#try" className="btn-secondary h-13 sm:w-auto sm:px-8">
                Try a quiz question
              </a>
            </div>
            <p className="quiz-rise text-sm text-faint [animation-delay:300ms]">Takes 20 seconds. Phone number or Google.</p>
          </div>

          <div className="quiz-rise [animation-delay:200ms]">
            <PhoneMock title={showLeague ? "State League · this week" : "Top states"} top={board} />
          </div>
        </section>

        {/* Live numbers */}
        <section className="reveal flex flex-col gap-4" aria-labelledby="live-title">
          <h2 id="live-title" className="flex items-center gap-2 text-sm font-bold text-muted">
            <span className="size-2 animate-pulse rounded-full bg-lime" />
            {APP_NAME} right now
          </h2>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-4">
            {metrics.map(([value, label], i) => (
              <div key={label} className="flex flex-col-reverse gap-1 bg-bg px-5 py-5">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className={`h-display text-[34px] leading-none md:text-[40px] ${i === 0 ? "text-lime-ink" : ""}`}>
                  <CountUp to={value} duration={1200} />
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Every state, scrolling */}
        <section className="reveal -mx-5 flex flex-col gap-3" aria-label="Corpers in every state">
          <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
            <ul className="marquee flex w-max gap-2.5">
              {[...stats.states, ...stats.states].map((s, i) => (
                <li
                  key={`${s.state}-${i}`}
                  aria-hidden={i >= stats.states.length || undefined}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-line px-4 py-2 text-sm"
                >
                  <span className="font-medium">{s.state}</span>
                  {s.count > 0 && <span className="font-bold text-lime-ink tabular-nums">{formatNumber(s.count)}</span>}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="empty:hidden md:max-w-[560px]">
          <EarlyCorperBanner deadline={earlyDeadline} />
        </div>

        {/* Who it's for */}
        <section className="flex flex-col gap-6" aria-labelledby="who-title">
          <h2 id="who-title" className="reveal h-display text-[30px] leading-tight md:text-[40px]">
            For every stage of NYSC
          </h2>
          <ul className="grid gap-3 md:grid-cols-3">
            {AUDIENCE.map(({ emoji, title, text }) => (
              <li key={title} className="reveal flex gap-4 rounded-3xl border border-line p-5 transition-colors hover:border-lime md:flex-col md:gap-3 md:p-6">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl" aria-hidden="true">
                  {emoji}
                </span>
                <span>
                  <span className="block text-[17px] font-bold">{title}</span>
                  <span className="mt-0.5 block leading-relaxed text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Try it */}
        <section id="try" className="reveal grid scroll-mt-20 items-center gap-8 md:grid-cols-[1fr_1.1fr] md:gap-12" aria-labelledby="try-title">
          <div className="flex flex-col gap-3">
            <span className="self-start rounded-full bg-pink px-3 py-1 text-xs font-bold tracking-wide text-on-accent uppercase">Try it now</span>
            <h2 id="try-title" className="h-display text-[30px] leading-tight md:text-[40px]">
              How well do you know NYSC?
            </h2>
            <p className="max-w-[30rem] leading-relaxed text-muted">
              These are real questions from the Daily Quiz. Answer fast for more points, then flip the card to learn something.
              No sign-up needed.
            </p>
          </div>
          <TryQuiz />
        </section>

        {/* What you get */}
        <section className="flex flex-col gap-6" aria-labelledby="features-title">
          <div className="reveal flex flex-col gap-2">
            <h2 id="features-title" className="h-display text-[30px] leading-tight md:text-[40px]">
              Something to look forward to every day
            </h2>
            <p className="max-w-[36rem] text-muted">Before call-up, all through service, and after you pass out.</p>
          </div>
          <ul className="grid gap-3 md:grid-cols-3">
            {FEATURES.map(({ title, text, art, wide, soon }) => (
              <li
                key={title}
                className={`reveal group flex flex-col gap-5 rounded-3xl border border-line p-6 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-lime ${
                  wide ? "md:col-span-2" : ""
                }`}
              >
                <div className="flex min-h-10 items-center" aria-hidden="true">
                  {art}
                </div>
                <div>
                  <h3 className="flex flex-wrap items-center gap-2 text-[19px] font-bold">
                    {title}
                    {soon && <span className="rounded-full bg-pink px-2.5 py-0.5 text-xs font-bold text-on-accent">Coming soon</span>}
                  </h3>
                  <p className="mt-1 leading-relaxed text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* League or top states */}
        {board.length > 0 && (
          <section className="reveal grid items-center gap-8 md:grid-cols-[1fr_1.1fr] md:gap-12" aria-labelledby="board-title">
            <div className="flex flex-col gap-3">
              <h2 id="board-title" className="h-display text-[30px] leading-tight md:text-[40px]">
                {showLeague ? "Which state is winning this week?" : "Where corpers are joining from"}
              </h2>
              <p className="max-w-[30rem] leading-relaxed text-muted">
                {showLeague
                  ? "Every Daily Quiz point counts for the state you serve in. States rank by points per corper, so your state needs you playing."
                  : "Corpers from every corner of Nigeria are already here. Is your state on the list?"}
              </p>
              {showLeague && (
                <p className="text-sm">
                  <span className="text-muted">This week ends in </span>
                  <Countdown to={league.endsAt} className="h-display font-bold text-lime-ink" />
                </p>
              )}
            </div>
            <ol className="flex flex-col gap-2 rounded-3xl border border-line p-4 md:p-5">
              {board.map((s, i) => (
                <li key={s.state} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-surface-2">
                  <span className="w-7 text-center text-lg">{["🥇", "🥈", "🥉"][i] ?? <span className="text-sm font-bold text-faint">{i + 1}</span>}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{s.state}</span>
                    <span className="mt-1.5 block h-1.5 rounded-full bg-surface-2" aria-hidden="true">
                      <span
                        className={`block h-1.5 rounded-full ${i === 0 ? "bg-lime" : "bg-pink/70"}`}
                        style={{ width: `${Math.max(4, (s.raw / max) * 100)}%` }}
                      />
                    </span>
                  </span>
                  <span className="w-20 text-right">
                    <span className="h-display block text-lg leading-none tabular-nums">{s.value}</span>
                    <span className="text-xs text-muted">{showLeague ? "pts per corper" : s.sub}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* How it works */}
        <section className="flex flex-col gap-6" aria-labelledby="how-title">
          <h2 id="how-title" className="reveal h-display text-[30px] leading-tight md:text-[40px]">
            Start in under a minute
          </h2>
          <ol className="grid gap-3 md:grid-cols-3">
            {STEPS.map(({ title, text }, i) => (
              <li key={title} className="reveal relative flex gap-4 rounded-3xl border border-line p-5 md:flex-col md:gap-3 md:p-6">
                <span className="h-display flex size-10 shrink-0 items-center justify-center rounded-full bg-lime text-lg text-on-accent">{i + 1}</span>
                <span>
                  <span className="block text-[17px] font-bold">{title}</span>
                  <span className="mt-0.5 block text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Trust */}
        <section className="reveal flex flex-col gap-6" aria-labelledby="trust-title">
          <h2 id="trust-title" className="h-display text-[30px] leading-tight md:text-[40px]">
            Your details stay yours
          </h2>
          <ul className="grid gap-3 md:grid-cols-3">
            {TRUST.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-3.5 rounded-3xl border border-line p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-lime-ink">
                  <Icon size={20} />
                </span>
                <span className="pt-2 leading-snug">{text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Questions people search for; the same list is in the structured data above. */}
        <section className="reveal flex flex-col gap-6" aria-labelledby="faq-title">
          <h2 id="faq-title" className="h-display text-[30px] leading-tight md:text-[40px]">
            Questions corpers ask
          </h2>
          <div className="divide-y divide-line rounded-3xl border border-line">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">
                  <h3>{q}</h3>
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xl leading-none text-muted transition-transform group-open:rotate-45 group-open:bg-lime group-open:text-on-accent"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2 leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing call to action */}
        <section className="reveal relative overflow-hidden rounded-[32px] bg-lime p-8 text-on-accent md:p-12">
          <div className="glow-drift absolute -top-16 -right-16 size-64 rounded-full bg-pink/40 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="h-display text-[30px] leading-tight md:text-[40px]">
                Join <CountUp to={stats.total} duration={1200} /> corpers on {APP_NAME}
              </h2>
              <p className="mt-1 font-medium opacity-75">Free, and it takes 20 seconds. Today&apos;s quiz is waiting.</p>
            </div>
            <Link
              href="/join"
              className="flex h-14 w-full shrink-0 items-center justify-center rounded-full bg-on-accent px-10 text-[17px] font-bold text-lime transition-transform hover:scale-105 md:w-auto"
            >
              Join free
            </Link>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-line pt-6 text-sm text-faint md:flex-row md:justify-between">
          <span>{APP_NAME} is an independent app for corps members. Not affiliated with NYSC.</span>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/login" className="hover:text-ink">
              Log in
            </Link>
          </span>
        </footer>
      </main>

      <StickyJoin watch="hero-cta" total={formatNumber(stats.total)} />
    </div>
  );
}
