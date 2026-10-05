import Link from "next/link";
import Countdown from "../Countdown";
import { TrophyIcon } from "../icons";
import { formatNgn } from "@/lib/reward-meta";
import type { Challenge } from "@/lib/challenges";

/** Home: the open (or upcoming) challenge, its live prize pool and a countdown. */
export default function ChallengeBanner({ c, pool, joined }: { c: Challenge; pool: number; joined: boolean }) {
  const upcoming = c.status === "upcoming" || (c.opens_at && c.opens_at.getTime() > Date.now());
  const to = upcoming ? c.opens_at : c.closes_at;
  return (
    <Link
      href={joined && !upcoming ? `/challenges/${c.slug}/mine` : `/challenges/${c.slug}`}
      className="relative flex flex-col gap-3 overflow-hidden rounded-3xl bg-pink p-5 text-on-accent"
    >
      <span className="absolute -top-10 -right-10 size-40 rounded-full bg-lime/40 blur-2xl" aria-hidden="true" />
      <span className="relative flex items-center gap-2 text-xs font-bold tracking-wide uppercase opacity-80">
        <TrophyIcon size={16} />
        {c.title}
      </span>
      <span className="relative">
        <span className="block text-sm font-medium opacity-80">Prize pool</span>
        <span className="h-display block text-[34px] leading-none">{formatNgn(pool)}</span>
        {pool < c.pool_cap && <span className="text-sm font-medium opacity-80">and growing with every entry 🔥</span>}
      </span>
      <span className="relative flex flex-wrap items-center justify-between gap-2">
        {to ? (
          <span className="text-sm font-bold">
            {upcoming ? "Opens in " : "Ends in "}
            <Countdown to={to.toISOString()} after={upcoming ? "Open now" : "Closed"} />
          </span>
        ) : (
          <span className="text-sm font-bold">Coming soon</span>
        )}
        <span className="rounded-full bg-on-accent px-4 py-2 text-sm font-bold text-pink">
          {joined && !upcoming ? "My entries" : "See how to enter"}
        </span>
      </span>
    </Link>
  );
}
