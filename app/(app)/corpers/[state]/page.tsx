import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import { ChevronLeft } from "@/components/icons";
import { requireUser } from "@/lib/session";
import { getPublicStats } from "@/lib/stats";
import { getStateMembers } from "@/lib/ranking";
import { stateFromSlug, stateSlug } from "@/lib/states";
import { formatNumber } from "@/lib/util";

const PAGE_SIZE = 30;

type Props = { params: Promise<{ state: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const state = stateFromSlug((await params).state);
  return { title: state ? `Corpers in ${state}` : "Corpers" };
}

export default async function StatePage({ params, searchParams }: Props) {
  const user = await requireUser();
  const state = stateFromSlug((await params).state);
  if (!state) notFound();
  const page = Math.max(1, Math.min(50, Number((await searchParams).page) || 1));

  const [stats, members] = await Promise.all([getPublicStats(), getStateMembers(state, page * PAGE_SIZE + 1)]);
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
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="h-display text-[34px] leading-none">{state}</h1>
          <p className="text-[15px] text-muted">
            {formatNumber(info?.count ?? 0)} {info?.count === 1 ? "corper" : "corpers"}
            {info && info.count > 0 ? ` · #${info.rank} state` : ""}
          </p>
        </div>
        {isMine && <span className="rounded-full bg-lime px-3 py-1.5 text-xs font-bold text-on-accent">Your state</span>}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-[20px] border-[1.5px] border-dashed border-line px-5 py-8 text-center">
          <p className="font-bold">No one from {state} yet</p>
          <p className="mt-1 text-sm text-muted">Know a corper serving here? Send them your link.</p>
          <Link href="/invite" className="mt-3 inline-block font-bold text-lime-ink">
            Invite friends
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-[22px]">
          {shown.map((m) => {
            const me = m.id === user.id;
            return (
              <li key={m.id} className="flex flex-col items-center gap-1.5">
                <Avatar id={m.id} nickname={m.nickname} photoVersion={m.photo_version} size={72} ring={me} />
                <span className={`w-full truncate text-center text-sm font-medium ${me ? "text-lime-ink" : ""}`}>
                  {m.nickname}
                  {me ? " (you)" : ""}
                </span>
                <span className="text-xs text-faint">#{formatNumber(m.position)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <Link href={`/corpers/${stateSlug(state)}?page=${page + 1}`} scroll={false} className="btn-secondary">
          Show more
        </Link>
      )}
    </>
  );
}
