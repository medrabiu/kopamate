import type { Metadata } from "next";
import Link from "next/link";
import { BizLogo } from "@/components/hustle/BizArt";
import { ChevronLeft } from "@/components/icons";
import Tabs from "@/components/Tabs";
import { sql } from "@/lib/db";
import { getBusinessByOwner, getType } from "@/lib/hustle/data";
import { getBoard, getStateEconomy, type BoardRow } from "@/lib/hustle/market";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Leaderboard" };

const BAND = { Bronze: "#d08a4a", Silver: "#b8c2cc", Gold: "#ffd166", Diamond: "#7fc4ff" } as const;
const TREND = { up: "↑", down: "↓", same: "–" } as const;

function Board({ rows, mine, empty }: { rows: BoardRow[]; mine: string | null; empty: string }) {
  if (!rows.length) return <p className="card text-[15px] text-muted">{empty}</p>;
  return (
    <ol className="card flex flex-col !p-0">
      {rows.map((r) => (
        <li key={r.id} className={`border-b border-line last:border-b-0 ${r.id === mine ? "bg-surface-2" : ""}`}>
          <Link href={`/hustle/b/${r.slug}`} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-muted">{r.rank}</span>
            <BizLogo icon={r.icon} color={r.color} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold">{r.id === mine ? `${r.name} (you)` : r.name}</span>
              <span className="block truncate text-[13px] text-muted">
                {r.type_name} · ★ {r.rating.toFixed(1)} · {r.owner}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold">
              <span className="h-2 w-2 rounded-full" style={{ background: BAND[r.band as keyof typeof BAND] }} aria-hidden="true" />
              {r.band}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export default async function LeaderboardPage() {
  const user = await requireUser();
  const mine = await getBusinessByOwner(sql, user.id);
  const state = mine?.state ?? user.state ?? "";
  const type = mine ? await getType(sql, mine.type_slug) : null;
  const [all, byType, states] = await Promise.all([
    state ? getBoard(state, null) : Promise.resolve([]),
    state && type ? getBoard(state, type.slug) : Promise.resolve([]),
    getStateEconomy(),
  ]);
  const labels = type ? [state, `${type.name}s`, "States"] : [state || "My state", "States"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/hustle" aria-label="Back to my business" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex flex-col">
          <h1 className="h-display text-[22px] leading-tight">Business leaderboard</h1>
          <span className="text-[13px] text-muted">Profit this week, rating, growth and cash health</span>
        </div>
      </div>
      <Tabs labels={labels}>
        <Board rows={all} mine={mine?.id ?? null} empty={`No ranked businesses in ${state || "your state"} yet.`} />
        {type && <Board rows={byType} mine={mine?.id ?? null} empty={`No other ${type.name.toLowerCase()}s yet.`} />}
        {states.length === 0 ? (
          <p className="card text-[15px] text-muted">No state economies yet.</p>
        ) : (
          <ol className="card flex flex-col !p-0">
            {states.map((s) => (
              <li key={s.state} className={`flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 ${s.state === state ? "bg-surface-2" : ""}`}>
                <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-muted">{s.rank}</span>
                <span className="flex-1 text-[15px] font-bold">{s.state}</span>
                <span className="text-[13px] text-muted">
                  {s.businesses} {s.businesses === 1 ? "business" : "businesses"}
                </span>
                <span
                  className={`w-5 text-center font-bold ${s.trend === "up" ? "text-lime-ink" : s.trend === "down" ? "text-pink-ink" : "text-muted"}`}
                  aria-label={s.trend === "same" ? "No change" : s.trend === "up" ? "Up on last week" : "Down on last week"}
                >
                  {TREND[s.trend]}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Tabs>
      <p className="text-center text-xs text-faint">States are ranked by their businesses&apos; total profit this week.</p>
    </div>
  );
}
