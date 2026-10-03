"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import BadgeCelebration from "./BadgeCelebration";
import Sheet from "./Sheet";
import { useToast } from "./Toast";
import type { Bump, Streak } from "@/lib/streaks";

type Ctx = { streak: Streak; apply: (b: Bump) => void };
const StreakCtx = createContext<Ctx | null>(null);

export function useStreak() {
  return useContext(StreakCtx);
}

/**
 * The day streak on Home, shared by the header chip and the quiz so finishing it updates both.
 * Kept quiet on purpose: no celebration for a normal day, just the chip turning lime. Only a freeze
 * being used or earned gets a toast, and a milestone badge gets the usual one-time badge celebration.
 */
export function StreakProvider({ initial, children }: { initial: Streak; children: React.ReactNode }) {
  const [streak, setStreak] = useState(initial);
  const [milestone, setMilestone] = useState<number | null>(null);
  const [toast, show] = useToast();

  const apply = useCallback(
    (b: Bump) => {
      setStreak((s) => {
        const todayAt = s.week.findIndex((d) => d === "today");
        const week = s.week.map((d, i): Streak["week"][number] => {
          if (i === todayAt) return "played";
          // Missed days this week that a freeze just covered.
          if (todayAt >= 0 && i < todayAt && i >= todayAt - b.saved && d === "missed") return "frozen";
          return d;
        });
        return { ...s, days: b.days, best: Math.max(s.best, b.days), freezes: b.freezes, today: true, covering: 0, week };
      });
      const note = b.saved > 0 ? `🧊 A freeze saved your ${b.days - 1}-day streak` : b.earnedFreeze ? "🧊 You earned a streak freeze" : null;
      // A milestone badge shows its own toast first; this one waits its turn.
      if (note) setTimeout(() => show(note), b.milestone ? 2600 : 0);
      if (b.milestone) setMilestone(b.milestone);
    },
    [show],
  );

  return (
    <StreakCtx.Provider value={{ streak, apply }}>
      {children}
      {toast}
      {milestone && <BadgeCelebration slug={`streak_${milestone}`} name={`${milestone}-Day Streak`} awardedAt={new Date().toISOString()} />}
    </StreakCtx.Provider>
  );
}

/** Lagos is UTC+1 all year. */
const lagosHour = (now: number) => new Date(now + 3600_000).getUTCHours();
const msToLagosMidnight = (now: number) => {
  const d = new Date(now + 3600_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - (now + 3600_000);
};
/** From this hour, an unplayed streak shows how long is left. */
const EVENING_HOUR = 18;

function useNow(everyMs: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** Header chip: 🔥 12. Grey until you finish today's quiz, then lime. In the evening it shows the hours left. */
export function StreakChip() {
  const ctx = useStreak();
  const now = useNow(60_000);
  const [open, setOpen] = useState(false);
  if (!ctx) return null;
  const { streak } = ctx;

  const atRisk = streak.days > 0 && !streak.today && now !== null && lagosHour(now) >= EVENING_HOUR;
  const hoursLeft = now === null ? 0 : Math.max(1, Math.ceil(msToLagosMidnight(now) / 3600_000));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${streak.days}-day streak${streak.today ? ", done today" : ""}`}
        className={`flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm font-bold tabular-nums ${
          streak.today ? "text-lime-ink" : atRisk ? "text-pink-ink" : "text-muted"
        }`}
      >
        <span aria-hidden="true" className={streak.today ? "" : "grayscale"}>
          🔥
        </span>
        <span key={streak.days} className="countdown-tick">
          {streak.days}
        </span>
        {atRisk && <span className="font-medium">· {hoursLeft}h left</span>}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={streak.days > 0 ? `${streak.days}-day streak` : "Your streak"}>
        <div className="flex justify-between gap-1 py-2">
          {streak.week.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={`flex size-9 items-center justify-center rounded-full text-sm ${
                  d === "played"
                    ? "bg-lime text-on-accent"
                    : d === "frozen"
                      ? "bg-surface-2"
                      : d === "today"
                        ? "border-2 border-dashed border-line"
                        : d === "missed"
                          ? "border border-line"
                          : "bg-surface-2 opacity-40"
                }`}
                aria-label={d}
              >
                {d === "played" ? "🔥" : d === "frozen" ? "🧊" : ""}
              </span>
              <span className={`text-xs ${d === "today" ? "font-bold text-ink" : "text-faint"}`}>{DAY_LETTERS[i]}</span>
            </div>
          ))}
        </div>

        <dl className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-surface-2 p-3.5">
            <dt className="text-[13px] text-muted">Best streak</dt>
            <dd className="h-display text-xl">{streak.best} {streak.best === 1 ? "day" : "days"}</dd>
          </div>
          <div className="rounded-2xl bg-surface-2 p-3.5">
            <dt className="text-[13px] text-muted">Freezes</dt>
            <dd className="h-display text-xl">🧊 {streak.freezes} of 2</dd>
          </div>
        </dl>

        <p className="text-sm text-muted">
          {streak.today
            ? "Done for today. Come back tomorrow to keep it going."
            : streak.days > 0
              ? streak.covering > 0
                ? "You missed a day. Play today's quiz and a freeze keeps your streak."
                : "Play today's quiz before midnight to keep your streak."
              : streak.best > 0
                ? "Play today's quiz to start a new streak."
                : "Play the Daily Quiz each day to build a streak. Every streak day adds 5 bonus points, up to 50."}
        </p>
        <p className="text-[13px] text-faint">
          A freeze covers a day you miss. You earn one for every 7 days in a row, and one when a friend joins with your link. Streaks of 7, 30 and 100 days earn a badge.
        </p>
      </Sheet>
    </>
  );
}
