import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { PersonButton } from "@/components/PersonSheet";
import { ChevronLeft } from "@/components/icons";
import { requireUser } from "@/lib/session";
import { getPublicStats } from "@/lib/stats";
import { getStateGroupCounts, getStateMembers, type MemberGroup } from "@/lib/ranking";
import { stateFromSlug, stateSlug } from "@/lib/states";
import { formatNumber } from "@/lib/util";

const PAGE_SIZE = 30;

type Props = { params: Promise<{ state: string }>; searchParams: Promise<{ page?: string; show?: string }> };

const GROUPS: { group: MemberGroup; label: string; empty: string }[] = [
  { group: "serving", label: "Serving", empty: "No one serving here yet" },
  { group: "served", label: "Ex-corpers", empty: "No ex-corpers from here yet" },
  { group: "waiting", label: "Awaiting call-up", empty: "No one awaiting call-up here yet" },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const state = stateFromSlug((await params).state);
  return { title: state ? `Corpers in ${state}` : "Corpers" };
}

export default async function StatePage({ params, searchParams }: Props) {
  const user = await requireUser();
  const state = stateFromSlug((await params).state);
  if (!state) notFound();
  const query = await searchParams;
  const page = Math.max(1, Math.min(50, Number(query.page) || 1));
  const tab = GROUPS.find((g) => g.group === query.show) ?? GROUPS[0];
  const base = `/corpers/${stateSlug(state)}`;
  const tabHref = (group: MemberGroup, p = 1) => {
    const params = new URLSearchParams();
    if (group !== "serving") params.set("show", group);
    if (p > 1) params.set("page", String(p));
    return params.size ? `${base}?${params}` : base;
  };

  const [stats, members, counts] = await Promise.all([
    getPublicStats(),
    getStateMembers(state, page * PAGE_SIZE + 1, tab.group),
    getStateGroupCounts(state),
  ]);
  const info = stats.states.find((s) => s.state === state);
  const hasMore = members.length > page * PAGE_SIZE;
  const shown = members.slice(0, page * PAGE_SIZE);
  const isMine = user.state === state;

  return (
    <>
      <div className="flex h-11 items-center">
        <Link href="/corpers" aria-label="Back to all states" className="flex size-11 items-center">
          <ChevronLeft size={24} />
        </Link>
      </div>
      <section className={`card flex items-center justify-between gap-3 !p-[18px] ${isMine ? "border-[1.5px] border-lime" : ""}`}>
        <div className="flex min-w-0 flex-col gap-1">
          {isMine && <span className="text-[13px] font-bold uppercase tracking-wider text-lime-ink">Your state</span>}
          <h1 className="h-display truncate text-[32px] leading-none">{state}</h1>
          <p className="text-[15px] text-muted">
            {formatNumber(counts.serving)} serving
            {counts.served > 0 && ` · ${formatNumber(counts.served)} ex-${counts.served === 1 ? "corper" : "corpers"}`}
          </p>
        </div>
        {info && info.count > 0 && (
          <div className="shrink-0 text-right">
            <div className="h-display text-[32px] leading-none text-pink-ink">#{info.rank}</div>
            <div className="mt-1 text-xs text-muted">of {stats.states.length} states</div>
          </div>
        )}
      </section>
      <nav aria-label="Who to show" className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
        {GROUPS.map((g) => (
          <Link
            key={g.group}
            href={tabHref(g.group)}
            replace
            scroll={false}
            aria-current={g.group === tab.group ? "page" : undefined}
            className={`flex h-10 items-center justify-center truncate rounded-full px-2 text-sm font-bold ${
              g.group === tab.group ? "bg-bg text-ink" : "text-muted"
            }`}
          >
            {g.label}
          </Link>
        ))}
      </nav>
      {shown.length > 0 && <p className="-mt-2 text-sm text-faint">Tap anyone to see their profile.</p>}

      {shown.length === 0 ? (
        <div className="rounded-[20px] border-[1.5px] border-dashed border-line px-5 py-8 text-center">
          <p className="font-bold">{tab.empty}</p>
          <p className="mt-1 text-sm text-muted">Know someone from {state}? Send them your link.</p>
          <Link href="/invite" className="mt-3 inline-block font-bold text-lime-ink">
            Invite friends
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-[22px]">
          {shown.map((m) => {
            const me = m.id === user.id;
            return (
              <li key={m.id}>
                <PersonButton id={m.id} label={m.nickname} className="flex w-full flex-col items-center gap-1.5 rounded-2xl py-1 active:bg-surface-2">
                  <Avatar id={m.id} nickname={m.nickname} photoVersion={m.photo_version} size={72} ring={me} />
                  <span className={`flex w-full items-center justify-center gap-1 text-sm font-medium ${me ? "text-lime-ink" : ""}`}>
                    <span className="truncate">
                      {m.nickname}
                      {me ? " (you)" : ""}
                    </span>
                    {m.verified && <VerifiedBadge />}
                  </span>
                  {m.position !== null && <span className="text-xs text-faint">#{formatNumber(m.position)}</span>}
                </PersonButton>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <Link href={tabHref(tab.group, page + 1)} prefetch={false} scroll={false} className="btn-secondary">
          Show more
        </Link>
      )}
    </>
  );
}
