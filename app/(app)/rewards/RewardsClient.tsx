"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Avatar from "@/components/Avatar";
import BadgeIcon from "@/components/BadgeIcon";
import Confetti from "@/components/Confetti";
import Sheet from "@/components/Sheet";
import { CheckIcon, ChevronRight, CrownIcon, LockIcon, SearchIcon } from "@/components/icons";
import { voteState } from "@/app/actions/rewards";
import { STATES } from "@/lib/states";
import type { BadgeInfo } from "@/lib/badge-meta";

export type BoardRow = {
  id: string;
  nickname: string;
  photo_version: number;
  state: string | null;
  refs: number;
  rank: number;
  top_badge: BadgeInfo | null;
};

function Row({ r, me, last }: { r: BoardRow; me: boolean; last?: boolean }) {
  return (
    <li className={`flex h-14 items-center gap-3 ${last ? "" : "border-b border-surface-2"}`} aria-current={me ? "true" : undefined}>
      <span className={`h-display w-7 shrink-0 text-center ${r.rank <= 3 ? "text-lime-ink" : "text-faint"}`}>{r.rank || "–"}</span>
      <Avatar id={r.id} nickname={r.nickname} photoVersion={r.photo_version} size={36} ring={me} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`flex min-w-0 items-center gap-1.5 ${me ? "font-bold text-lime-ink" : "font-medium"}`}>
          <span className="truncate">{me ? "You" : r.nickname}</span>
          <BadgeIcon badge={r.top_badge} />
        </span>
        {r.state && <span className="truncate text-xs text-muted">{r.state}</span>}
      </span>
      <span className="font-bold tabular-nums">{r.refs}</span>
    </li>
  );
}

/** "Nigeria" (top 20) and "My state" (top 10) tabs. The user's row is highlighted, or pinned below the list. */
export function Leaderboard({
  national,
  state,
  stateName,
  meNational,
  meState,
  userId,
}: {
  national: BoardRow[];
  state: BoardRow[];
  stateName: string;
  meNational: BoardRow;
  meState: BoardRow;
  userId: string;
}) {
  const [tab, setTab] = useState<"nigeria" | "state">("nigeria");
  const rows = tab === "nigeria" ? national : state;
  const me = tab === "nigeria" ? meNational : meState;
  const inList = rows.some((r) => r.id === userId);
  const tabs = [
    { key: "nigeria" as const, label: "Nigeria" },
    { key: "state" as const, label: stateName || "My state" },
  ];

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="board-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="board-title" className="h-display text-xl">
          Leaderboard
        </h2>
        <span className="text-xs text-faint">Friends joined</span>
      </div>
      <div role="tablist" aria-label="Leaderboard" className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls="board-panel"
            onClick={() => setTab(t.key)}
            className={`h-10 truncate rounded-full px-3 text-sm font-bold ${tab === t.key ? "bg-lime text-on-accent" : "text-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id="board-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <p className="rounded-[20px] bg-surface px-4 py-5 text-sm text-muted">
            No one is on the board{tab === "state" ? ` in ${stateName}` : ""} yet. Invite a friend to take the lead.
          </p>
        ) : (
          <ol className="rounded-[20px] bg-surface px-4 py-1">
            {rows.map((r, i) => (
              <Row key={r.id} r={r} me={r.id === userId} last={i === rows.length - 1} />
            ))}
          </ol>
        )}
        {!inList && (
          <ol className="rounded-2xl border-[1.5px] border-lime px-4">
            <Row r={me} me last />
          </ol>
        )}
      </div>
    </section>
  );
}

type Prize = { key: string; title: string; line: string; details: string[] };

/** Mystery prize cards: no amounts until the reveal. */
export function MysteryPrizes({ prizes, revealText }: { prizes: Prize[]; revealText: string }) {
  const [open, setOpen] = useState<Prize | null>(null);
  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="prizes-title">
      <h2 id="prizes-title" className="h-display text-xl">
        Prizes
      </h2>
      <ul className="flex flex-col gap-2.5">
        {prizes.map((p) => (
          <li key={p.key}>
            <button
              type="button"
              onClick={() => setOpen(p)}
              className="flex w-full items-center gap-3.5 rounded-[18px] bg-surface p-4 text-left"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-pink-ink">
                <LockIcon size={18} strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{p.title}</span>
                <span className="block text-sm text-muted">{p.line}</span>
                <span className="mt-0.5 block text-xs text-faint">{revealText}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-faint" />
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.title ?? "Prize"}>
        {open && (
          <div className="flex flex-col gap-3">
            <span className="flex items-center gap-2 self-start rounded-full bg-surface-2 px-3 py-1.5 text-xs font-bold">
              <LockIcon size={13} strokeWidth={2.5} />
              Mystery prize
            </span>
            {open.details.map((d) => (
              <p key={d} className="text-[15px] leading-normal">
                {d}
              </p>
            ))}
            <p className="text-sm text-muted">{revealText}</p>
          </div>
        )}
      </Sheet>
    </section>
  );
}

/** State Ambassador programme card with a "Learn more" sheet. */
export function AmbassadorCard({ leading }: { leading: string }) {
  const [open, setOpen] = useState(false);
  const perks = [
    "Kopamate team member (state admin)",
    "State Ambassador badge",
    "Promotion budget for your state",
    "First access to new features",
    "Featured on Kopamate",
    "Certificate of recognition",
  ];
  return (
    <section className="flex flex-col gap-2.5 rounded-[20px] border-[1.5px] border-pink px-[18px] py-4" aria-labelledby="amb-title">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pink text-on-accent">
          <CrownIcon size={18} strokeWidth={2.4} />
        </span>
        <h2 id="amb-title" className="h-display text-lg leading-tight">
          State Ambassador programme
        </h2>
      </div>
      <p className="text-[15px] leading-normal">
        The top referrer in each state when camp ends becomes that state&apos;s Kopamate Ambassador.
      </p>
      <p className="text-sm font-medium text-pink-ink">{leading}</p>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary h-11 text-[15px]">
        Learn more
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="State Ambassadors">
        <p className="text-[15px] leading-normal">
          The top referrer in each state when camp ends becomes that state&apos;s Kopamate Ambassador.
        </p>
        <ul className="flex flex-col gap-2">
          {perks.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-[15px]">
              <CheckIcon size={18} strokeWidth={2.5} className="mt-0.5 shrink-0 text-lime-ink" />
              {p}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-normal text-muted">
          Ambassadors must be in good standing (no fake referrals). Final selection is confirmed by the Kopamate team.
        </p>
        <p className="text-sm font-medium text-pink-ink">{leading}</p>
      </Sheet>
    </section>
  );
}

/**
 * "Which state will have the most corpers when camp ends?" Search, tap to vote, then live % bars
 * (top 8 plus your pick). Votes can change until the deadline.
 */
export function StatePrediction({
  results,
  myPick,
  locked,
  lockLabel,
}: {
  results: { total: number; states: { state: string; votes: number }[] };
  myPick: string | null;
  locked: boolean;
  lockLabel: string;
}) {
  const [pick, setPick] = useState(myPick);
  const [choosing, setChoosing] = useState(!myPick && !locked);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setPick(myPick), [myPick]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? STATES.filter((s) => s.toLowerCase().includes(q)) : STATES;
  }, [query]);

  function vote(state: string) {
    setError(null);
    start(async () => {
      try {
        const res = await voteState(state);
        if (res?.error) return setError(res.error);
        setPick(state);
        setChoosing(false);
      } catch {
        setError("Couldn't save your vote. Check your connection and try again.");
      }
    });
  }

  const top = results.states.slice(0, 8);
  const pickRow = pick && !top.some((s) => s.state === pick) ? (results.states.find((s) => s.state === pick) ?? { state: pick, votes: 0 }) : null;
  const pct = (v: number) => (results.total ? Math.round((v / results.total) * 100) : 0);

  return (
    <section id="predict" className="card flex scroll-mt-5 flex-col gap-3" aria-labelledby="predict-title">
      <div>
        <h2 id="predict-title" className="h-display text-xl leading-tight">
          Which state will have the most corpers when camp ends?
        </h2>
        <p className="mt-1 text-sm text-muted">{lockLabel}</p>
      </div>

      {choosing ? (
        <>
          <label className="relative block">
            <span className="sr-only">Search states</span>
            <SearchIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search states"
              className="field h-11 bg-bg pl-10"
            />
          </label>
          <ul className="no-scrollbar -mx-1 flex max-h-72 flex-col overflow-y-auto px-1" aria-label="States">
            {filtered.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => vote(s)}
                  className={`flex h-11 w-full items-center justify-between rounded-xl px-3 text-left text-[15px] hover:bg-surface-2 disabled:opacity-60 ${
                    s === pick ? "font-bold text-lime-ink" : ""
                  }`}
                >
                  {s}
                  {s === pick && <CheckIcon size={18} strokeWidth={2.5} />}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-muted">No state matches.</li>}
          </ul>
          {pick && (
            <button type="button" onClick={() => setChoosing(false)} className="text-sm font-bold text-muted">
              Cancel
            </button>
          )}
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-2" aria-label="Votes so far">
            {top.map((s) => (
              <Bar key={s.state} label={s.state} percent={pct(s.votes)} mine={s.state === pick} />
            ))}
            {pickRow && <Bar label={`Your pick: ${pickRow.state}`} percent={pct(pickRow.votes)} mine />}
            {top.length === 0 && !pickRow && <li className="text-sm text-muted">No votes yet.</li>}
          </ul>
          <p className="text-xs text-faint">
            {results.total.toLocaleString("en-NG")} {results.total === 1 ? "vote" : "votes"} · updates every 30 seconds
          </p>
          {!locked && (
            <button type="button" onClick={() => setChoosing(true)} className="btn-secondary h-11 text-[15px]">
              {pick ? "Change my vote" : "Vote"}
            </button>
          )}
        </>
      )}
      {pending && <p className="text-sm text-muted">Saving your vote…</p>}
      {error && <p className="text-sm text-pink-ink">{error}</p>}
    </section>
  );
}

function Bar({ label, percent, mine }: { label: string; percent: number; mine: boolean }) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className={`flex items-center gap-1.5 ${mine ? "font-bold" : ""}`}>
          {label}
          {mine && <span className="rounded-full bg-lime px-1.5 py-px text-[11px] font-bold text-on-accent">Your pick</span>}
        </span>
        <span className="tabular-nums text-muted">{percent}%</span>
      </div>
      <div className="h-2 rounded-full bg-surface-2">
        <div className={`h-2 rounded-full ${mine ? "bg-lime" : "bg-muted/50"}`} style={{ width: `${Math.max(percent ? 2 : 0, percent)}%` }} />
      </div>
    </li>
  );
}

const RANKS_KEY = "km_rewards_ranks";

/** Confetti when your national or state referrer rank improved since your last Rewards visit (remembered on this device). */
export function RankConfetti({ national, state }: { national: number | null; state: number | null }) {
  const [fire, setFire] = useState(false);
  useEffect(() => {
    try {
      const prev = JSON.parse(localStorage.getItem(RANKS_KEY) || "null") as { national: number | null; state: number | null } | null;
      const better = (now: number | null, before: number | null | undefined) => now !== null && (before == null || now < before);
      if (prev && (better(national, prev.national) || better(state, prev.state))) setFire(true);
      localStorage.setItem(RANKS_KEY, JSON.stringify({ national, state }));
    } catch {
      // Storage blocked or corrupt: no celebration, nothing breaks.
    }
  }, [national, state]);
  return <Confetti fire={fire} />;
}
