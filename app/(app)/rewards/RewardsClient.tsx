"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import BadgeIcon from "@/components/BadgeIcon";
import Confetti from "@/components/Confetti";
import { PersonButton } from "@/components/PersonSheet";
import Sheet from "@/components/Sheet";
import ShareButtons from "@/components/ShareButtons";
import { CheckIcon, ChevronRight, CrownIcon, LockIcon } from "@/components/icons";
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
    <li className={last ? "" : "border-b border-line"} aria-current={me ? "true" : undefined}>
      <PersonButton id={r.id} label={r.nickname} className="flex h-14 w-full items-center gap-3">
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
      </PersonButton>
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
  const [expanded, setExpanded] = useState(false);
  const all = tab === "nigeria" ? national : state;
  const rows = expanded ? all : all.slice(0, 10);
  const me = tab === "nigeria" ? meNational : meState;
  const inList = rows.some((r) => r.id === userId);
  const more = all.length - rows.length;
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
      <div role="tablist" aria-label="Leaderboard" className="grid grid-cols-2 gap-1 rounded-full border border-line p-1">
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
          <p className="rounded-[20px] border border-line px-4 py-5 text-sm text-muted">
            No one is on the board{tab === "state" ? ` in ${stateName}` : ""} yet. Invite a friend to take the lead.
          </p>
        ) : (
          <ol className="rounded-[20px] border border-line px-4 py-1">
            {rows.map((r, i) => (
              <Row key={r.id} r={r} me={r.id === userId} last={i === rows.length - 1} />
            ))}
          </ol>
        )}
        {more > 0 && (
          <button type="button" onClick={() => setExpanded(true)} className="py-1 text-sm font-bold text-lime-ink">
            Show top {all.length}
          </button>
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

export type Prize = {
  key: string;
  title: string;
  line: string;
  details: string[];
  /** Small tag on the row, e.g. "You have the badge". */
  tag?: string;
};

const PERKS = [
  "Kopamate team member (state admin)",
  "State Ambassador badge",
  "Promotion budget for your state",
  "First access to new features",
  "Featured on Kopamate",
  "Certificate of recognition",
];

/**
 * Every prize in one card: Top 10, State Ambassadors, Early Corpers. No amounts until the reveal.
 * Each row opens a sheet with how it's decided; the Ambassador sheet adds the perks, who's leading and a share button.
 */
export function Prizes({
  prizes,
  revealText,
  leading,
  share,
}: {
  prizes: Prize[];
  revealText: string;
  leading: string;
  share: { link: string; whatsappUrl: string; message: string };
}) {
  const [open, setOpen] = useState<Prize | null>(null);
  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="prizes-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="prizes-title" className="h-display text-xl">
          Prizes
        </h2>
        <span className="flex items-center gap-1 text-xs text-faint">
          <LockIcon size={12} strokeWidth={2.5} />
          Amounts revealed later
        </span>
      </div>
      <ul className="divide-y divide-line rounded-[20px] border border-line">
        {prizes.map((p) => (
          <li key={p.key}>
            <button type="button" onClick={() => setOpen(p)} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left">
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                  p.key === "ambassadors" ? "bg-pink text-on-accent" : "bg-surface-2 text-pink-ink"
                }`}
              >
                {p.key === "ambassadors" ? <CrownIcon size={18} strokeWidth={2.4} /> : <LockIcon size={18} strokeWidth={2.4} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-bold">{p.title}</span>
                  {p.tag && <span className="rounded-full bg-lime px-2 py-0.5 text-[11px] font-bold text-on-accent">{p.tag}</span>}
                </span>
                <span className="block text-sm leading-snug text-muted">{p.key === "ambassadors" ? leading : p.line}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-faint" />
            </button>
          </li>
        ))}
      </ul>
      <p className="px-1 text-xs text-faint">{revealText}</p>

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.title ?? "Prize"}>
        {open && (
          <div className="flex flex-col gap-3">
            {open.details.map((d) => (
              <p key={d} className="text-[15px] leading-normal">
                {d}
              </p>
            ))}
            {open.key === "ambassadors" && (
              <>
                <ul className="flex flex-col gap-2">
                  {PERKS.map((perk) => (
                    <li key={perk} className="flex items-start gap-2.5 text-[15px]">
                      <CheckIcon size={18} strokeWidth={2.5} className="mt-0.5 shrink-0 text-lime-ink" />
                      {perk}
                    </li>
                  ))}
                </ul>
                <p className="text-sm font-medium text-pink-ink">{leading}</p>
                <ShareButtons variant="compact" link={share.link} whatsappUrl={share.whatsappUrl} message={share.message} />
              </>
            )}
            {open.key !== "ambassadors" && (
              <span className="flex items-center gap-2 self-start rounded-full bg-surface-2 px-3 py-1.5 text-xs font-bold">
                <LockIcon size={13} strokeWidth={2.5} />
                {revealText}
              </span>
            )}
          </div>
        )}
      </Sheet>
    </section>
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
