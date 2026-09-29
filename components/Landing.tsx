import Link from "next/link";
import Avatar from "./Avatar";
import ComingSoon from "./ComingSoon";
import CountUp from "./CountUp";
import HeroArt from "./HeroArt";
import PrizeCard from "./PrizeCard";
import { APP_NAME } from "@/lib/config";
import type { PublicStats } from "@/lib/stats";
import { formatNumber } from "@/lib/util";

type Props = {
  stats: PublicStats;
  prizeText: string;
  inviter: { id: string; nickname: string; photo_version: number } | null;
};

export default function Landing({ stats, prizeText, inviter }: Props) {
  const top = stats.states.filter((s) => s.count > 0).slice(0, 5);

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-6 px-5 pb-10 pt-5">
      <header className="flex h-11 items-center justify-between">
        <span className="h-display text-xl">{APP_NAME}</span>
        <Link href="/login" className="px-1 py-2.5 text-[15px] font-medium text-lime-ink hover:opacity-80">
          Log in
        </Link>
      </header>

      {inviter && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-surface px-3.5 py-3">
          <Avatar id={inviter.id} nickname={inviter.nickname} photoVersion={inviter.photo_version} size={36} />
          <p className="text-sm">
            <span className="font-bold">{inviter.nickname}</span> invited you to join
          </p>
        </div>
      )}

      <section className="flex flex-col gap-3.5">
        <HeroArt />
        <span className="self-start rounded-full bg-lime px-3 py-1.5 text-[13px] font-medium text-on-accent">
          For corps members across Nigeria
        </span>
        <h1 className="h-display text-[44px] leading-[1.02]">
          Every corper.
          <br />
          <span className="text-pink-ink">One place.</span>
        </h1>
        <p className="text-base leading-normal text-muted">
          Join early, climb the list, and be first in line for contests, awards and prizes.
        </p>
      </section>

      <section className="card flex flex-col gap-1.5 !p-[22px]" aria-label="Signups">
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <span className="size-2 animate-pulse rounded-full bg-lime" />
          Live
        </div>
        <div className="h-display text-[64px] leading-none">
          <CountUp to={stats.total} />
        </div>
        <div className="text-base">corpers have joined</div>
        {stats.today > 0 && <div className="text-sm font-medium text-lime-ink">+{formatNumber(stats.today)} today</div>}
      </section>

      <Link href="/join" className="btn-primary">
        Join now
      </Link>

      {top.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="h-display text-xl">Top states</h2>
          <ol className="rounded-[20px] bg-surface px-4 py-2">
            {top.map((s, i) => (
              <li key={s.state} className={`flex h-11 items-center gap-3 ${i < top.length - 1 ? "border-b border-surface-2" : ""}`}>
                <span className={`h-display w-5 ${i < 3 ? "text-lime-ink" : "text-muted"}`}>{i + 1}</span>
                <span className="flex-1 font-medium">{s.state}</span>
                <span className="text-muted">{formatNumber(s.count)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <ComingSoon layout="grid" />
      <PrizeCard text={prizeText} />

      <footer className="pt-2 text-center text-xs text-faint">
        {APP_NAME} is an independent app for corps members. Not affiliated with NYSC.{" "}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>
      </footer>
    </main>
  );
}
