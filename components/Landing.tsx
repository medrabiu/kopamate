import Link from "next/link";
import CountUp from "./CountUp";
import EarlyCorperBanner from "./EarlyCorperBanner";
import { CheckIcon, GiftIcon, LockIcon, MedalIcon, ShieldIcon, TrophyIcon, UsersIcon } from "./icons";
import { APP_NAME, APP_URL, SITE_DESCRIPTION } from "@/lib/config";
import { STATES } from "@/lib/states";
import type { PublicStats } from "@/lib/stats";
import { formatNumber } from "@/lib/util";

type Props = { stats: PublicStats; earlyDeadline: string };

/** Shown on the page and given to search engines as FAQ structured data, so both always match. */
const FAQ = [
  {
    q: `What is ${APP_NAME}?`,
    a: `${APP_NAME} is a free app for NYSC corps members across Nigeria. You can find corpers serving in your state, earn badges for your service year, and win prizes, contests and awards made for corpers.`,
  },
  {
    q: `Is ${APP_NAME} an official NYSC app?`,
    a: `No. ${APP_NAME} is an independent app for corps members and is not affiliated with the National Youth Service Corps.`,
  },
  { q: `Is ${APP_NAME} free?`, a: "Yes. Signing up and using the app is free." },
  {
    q: "Who can join?",
    a: "Corps members serving in any of Nigeria's 36 states and the FCT. Sign up with your phone number or Google in about 20 seconds.",
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

const FEATURES = [
  {
    Icon: UsersIcon,
    title: "Find corpers in your state",
    text: "See who's serving where across all 36 states and the FCT. Tap anyone to see their profile and badges.",
  },
  {
    Icon: GiftIcon,
    title: "Win real prizes",
    text: "Cash, airtime and data for active corpers, claimed in the app and paid straight to you.",
  },
  {
    Icon: MedalIcon,
    title: "Earn badges for your service year",
    text: "Early Corper, State Ambassador and more, shown next to your name everywhere.",
  },
  {
    Icon: TrophyIcon,
    title: "Contests, awards and opportunities",
    text: "Best Khaki Drip, Corper of the Month, jobs from ex-corpers, remote gigs and SAED. Coming soon.",
  },
];

const STEPS = [
  { title: "Sign up in 20 seconds", text: "With your phone number or Google. Free." },
  { title: "Pick your state", text: "Add your state code and NYSC ID card to get verified." },
  { title: "Join in", text: "Meet corpers near you, earn badges and claim prizes." },
];

const TRUST = [
  { Icon: LockIcon, text: "Your phone number is never shown to anyone." },
  { Icon: ShieldIcon, text: "Prizes go to verified corpers only, checked by ID." },
  { Icon: CheckIcon, text: "Hide yourself from lists or delete your account any time." },
];

/** The public landing page at / (and invite links). Logged-in users never see it. */
export default function Landing({ stats, earlyDeadline }: Props) {
  const top = stats.states.filter((s) => s.count > 0).slice(0, 5);
  const max = Math.max(1, ...top.map((s) => s.count));
  const metrics: [number, string, string?][] = [
    [stats.total, "corpers joined"],
    [stats.activeStates, `of ${STATES.length} states`],
    [stats.today, "joined today"],
    [stats.verified, "verified corpers"],
  ];

  return (
    <div className="min-h-dvh">
      <script
        type="application/ld+json"
        // JSON with "<" escaped, so nothing in it can close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, "\\u003c") }}
      />
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1040px] items-center justify-between px-5">
          <span className="h-display text-xl">{APP_NAME}</span>
          <nav className="flex items-center gap-1.5">
            <Link href="/login" className="rounded-full px-3.5 py-2 text-[15px] font-bold hover:bg-surface-2">
              Log in
            </Link>
            <Link href="/join" className="rounded-full bg-lime px-4 py-2 text-[15px] font-bold text-on-accent">
              Join
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1040px] flex-col gap-14 px-5 pb-12 pt-10 md:gap-20 md:pt-16">
        {/* Hero */}
        <section className="grid items-center gap-8 md:grid-cols-[1.15fr_1fr] md:gap-12">
          <div className="flex flex-col gap-5">
            <span className="self-start rounded-full border border-line px-3 py-1.5 text-[13px] font-medium text-muted">
              For NYSC corps members across Nigeria
            </span>
            <h1 className="h-display text-[40px] leading-[1.05] md:text-[56px]">
              The home for every NYSC corper in Nigeria.
            </h1>
            <p className="max-w-[34rem] text-[17px] leading-relaxed text-muted">
              {APP_NAME} brings corpers from every state into one place. Find people serving near you, earn badges for your
              service year, and win prizes, contests and awards made for corpers.
            </p>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Link href="/join" className="btn-primary h-13 sm:w-auto sm:px-8">
                Join free
              </Link>
              <Link href="/login" className="btn-secondary h-13 sm:w-auto sm:px-8">
                Log in
              </Link>
            </div>
            <p className="text-sm text-faint">Takes 20 seconds. Phone number or Google.</p>
          </div>

          {/* Live metrics */}
          <section className="flex flex-col gap-4 rounded-3xl border border-line p-5 md:p-6" aria-labelledby="live-title">
            <div className="flex items-center justify-between">
              <h2 id="live-title" className="font-bold">
                {APP_NAME} right now
              </h2>
              <span className="flex items-center gap-1.5 text-[13px] text-muted">
                <span className="size-2 animate-pulse rounded-full bg-lime" />
                Live
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
              {metrics.map(([value, label], i) => (
                <div key={label} className="flex flex-col-reverse gap-0.5 bg-bg px-4 py-4">
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd className={`h-display text-[32px] leading-none ${i === 0 ? "text-lime-ink" : ""}`}>
                    {i === 0 ? <CountUp to={value} /> : formatNumber(value)}
                  </dd>
                </div>
              ))}
            </dl>
            {top.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <h3 className="text-sm font-bold">Top states</h3>
                <ol className="flex flex-col gap-2.5">
                  {top.map((s, i) => (
                    <li key={s.state} className="flex items-center gap-3 text-sm">
                      <span className={`w-4 font-bold ${i < 3 ? "text-lime-ink" : "text-faint"}`}>{i + 1}</span>
                      <span className="w-24 shrink-0 truncate font-medium">{s.state}</span>
                      <span className="h-1.5 flex-1 rounded-full bg-surface-2" aria-hidden="true">
                        <span className="block h-1.5 rounded-full bg-pink/70" style={{ width: `${Math.max(4, (s.count / max) * 100)}%` }} />
                      </span>
                      <span className="w-10 text-right font-bold tabular-nums">{formatNumber(s.count)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        </section>

        <div className="md:max-w-[560px]">
          <EarlyCorperBanner deadline={earlyDeadline} />
        </div>

        {/* What you get */}
        <section className="flex flex-col gap-6" aria-labelledby="features-title">
          <div className="flex flex-col gap-2">
            <h2 id="features-title" className="h-display text-[28px] leading-tight md:text-[36px]">
              Built for service year
            </h2>
            <p className="max-w-[36rem] text-muted">Everything a corper needs from orientation camp to passing out, in one app.</p>
          </div>
          <ul className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-2">
            {FEATURES.map(({ Icon, title, text }) => (
              <li key={title} className="flex gap-4 bg-bg p-5 md:p-6">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line text-lime-ink">
                  <Icon size={20} />
                </span>
                <span>
                  <span className="block text-[17px] font-bold">{title}</span>
                  <span className="mt-1 block leading-relaxed text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section className="flex flex-col gap-6" aria-labelledby="how-title">
          <h2 id="how-title" className="h-display text-[28px] leading-tight md:text-[36px]">
            How it works
          </h2>
          <ol className="grid gap-3 md:grid-cols-3">
            {STEPS.map(({ title, text }, i) => (
              <li key={title} className="flex gap-4 rounded-3xl border border-line p-5 md:flex-col md:gap-3">
                <span className="h-display flex size-9 shrink-0 items-center justify-center rounded-full bg-lime text-on-accent">{i + 1}</span>
                <span>
                  <span className="block font-bold">{title}</span>
                  <span className="mt-0.5 block text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Trust */}
        <section className="flex flex-col gap-6" aria-labelledby="trust-title">
          <h2 id="trust-title" className="h-display text-[28px] leading-tight md:text-[36px]">
            Your details stay yours
          </h2>
          <ul className="divide-y divide-line rounded-3xl border border-line">
            {TRUST.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-4 px-5 py-4">
                <Icon size={20} className="shrink-0 text-lime-ink" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Questions people search for; the same list is in the structured data above. */}
        <section className="flex flex-col gap-6" aria-labelledby="faq-title">
          <h2 id="faq-title" className="h-display text-[28px] leading-tight md:text-[36px]">
            Questions corpers ask
          </h2>
          <div className="divide-y divide-line rounded-3xl border border-line">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">
                  <h3>{q}</h3>
                  <span aria-hidden="true" className="shrink-0 text-xl leading-none text-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing call to action */}
        <section className="flex flex-col items-start gap-4 rounded-3xl border-[1.5px] border-lime p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <h2 className="h-display text-[26px] leading-tight md:text-[32px]">Join {formatNumber(stats.total)} corpers on {APP_NAME}</h2>
            <p className="mt-1 text-muted">Free, and it takes 20 seconds.</p>
          </div>
          <Link href="/join" className="btn-primary h-13 w-full shrink-0 md:w-auto md:px-10">
            Join free
          </Link>
        </section>

        <footer className="flex flex-col gap-2 border-t border-line pt-6 text-sm text-faint md:flex-row md:justify-between">
          <span>
            {APP_NAME} is an independent app for corps members. Not affiliated with NYSC.
          </span>
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
    </div>
  );
}
