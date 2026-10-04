import type { Metadata } from "next";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { ChevronRight } from "@/components/icons";
import { requireUser } from "@/lib/session";
import { getPublicStats } from "@/lib/stats";
import { getStateMembers } from "@/lib/ranking";
import { stateSlug } from "@/lib/states";
import { formatNumber } from "@/lib/util";
import StateList from "./StateList";

export const metadata: Metadata = { title: "Corpers" };

export default async function CorpersPage() {
  const user = await requireUser();
  const [stats, faces] = await Promise.all([getPublicStats(), user.state ? getStateMembers(user.state, 5) : Promise.resolve([])]);
  const rows = stats.states.map((s) => ({ ...s, slug: stateSlug(s.state) }));
  const mine = stats.states.find((s) => s.state === user.state);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="h-display text-[28px]">Corpers</h1>
        <p className="text-[15px] text-muted">
          <span className="font-bold text-lime-ink">{formatNumber(stats.total)}</span> joined across {stats.activeStates}{" "}
          {stats.activeStates === 1 ? "state" : "states"}
        </p>
      </div>

      {user.state && mine && (
        <Link href={`/corpers/${stateSlug(user.state)}`} className="card flex flex-col gap-3.5 border-[1.5px] border-lime !p-[18px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-bold uppercase tracking-wider text-lime-ink">Your state</div>
              <div className="h-display truncate text-[26px] leading-tight">{user.state}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="h-display text-[26px] leading-tight text-pink-ink">#{mine.rank}</div>
              <div className="text-xs text-muted">of {stats.states.length} states</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {faces.length > 0 && (
              <span className="flex shrink-0">
                {faces.map((f, i) => (
                  <Avatar
                    key={f.id}
                    id={f.id}
                    nickname={f.nickname}
                    photoVersion={f.photo_version}
                    size={32}
                    className={`ring-2 ring-surface ${i > 0 ? "-ml-2" : ""}`}
                  />
                ))}
              </span>
            )}
            <span className="min-w-0 flex-1 text-sm text-muted">
              {formatNumber(mine.count)} {mine.count === 1 ? "corper" : "corpers"} here
            </span>
            <ChevronRight size={20} className="shrink-0 text-lime-ink" />
          </div>
        </Link>
      )}

      <StateList rows={rows} myState={user.state} />
    </>
  );
}
