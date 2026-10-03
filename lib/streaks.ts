import "server-only";
import type postgres from "postgres";
import { sql } from "./db";
import { lagosDate } from "./util";

/**
 * Day streaks. A day counts when you finish the Daily Quiz, by Lagos date.
 * Freezes cover missed days so one bad day doesn't end a long streak: you earn one every
 * FREEZE_EVERY days in a row and one per friend who joins with your link, holding at most MAX_FREEZES.
 * Freezes are used lazily: the next pick covers the gap if you hold enough, otherwise the streak restarts.
 */
export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;
/** Streak lengths that earn a badge (slugs streak_<n> in db/schema.sql). */
export const STREAK_BADGES = [7, 30, 100];

type Db = postgres.Sql | postgres.ReservedSql;

export type Bump = {
  days: number;
  /** Missed days a freeze just covered. */
  saved: number;
  /** A freeze was earned by this day. */
  earnedFreeze: boolean;
  /** The streak just reached a badge length. */
  milestone: number | null;
  /** Freezes held after this day. */
  freezes: number;
};

/** Counts today for the user's streak. Call inside the quiz answer transaction (the user row is locked). */
export async function bumpStreak(db: Db, userId: string): Promise<Bump> {
  const today = lagosDate();
  const [u] = await db<{ days: number; freezes: number; best: number; gap: number | null }[]>`
    SELECT streak AS days, streak_freezes AS freezes, streak_best AS best,
           (${today}::date - streak_on - 1) AS gap
    FROM users WHERE id = ${userId}
  `;
  // Already counted today.
  if (u.gap === -1) return { days: u.days, saved: 0, earnedFreeze: false, milestone: null, freezes: u.freezes };

  let days = 1;
  let freezes = u.freezes;
  let saved = 0;
  if (u.days > 0 && u.gap === 0) days = u.days + 1;
  else if (u.days > 0 && u.gap !== null && u.gap > 0 && u.gap <= freezes) {
    saved = u.gap;
    freezes -= saved;
    days = u.days + 1;
    await db`
      INSERT INTO streak_days (user_id, day, frozen)
      SELECT ${userId}, d::date, true FROM generate_series(${today}::date - ${saved}::int, ${today}::date - 1, interval '1 day') d
      ON CONFLICT DO NOTHING
    `;
  }
  const earnedFreeze = days % FREEZE_EVERY === 0 && freezes < MAX_FREEZES;
  if (earnedFreeze) freezes += 1;

  await db`
    UPDATE users SET streak = ${days}, streak_on = ${today}::date, streak_freezes = ${freezes},
      streak_best = GREATEST(streak_best, ${days})
    WHERE id = ${userId}
  `;
  await db`INSERT INTO streak_days (user_id, day) VALUES (${userId}, ${today}::date) ON CONFLICT DO NOTHING`;
  return { days, saved, earnedFreeze, milestone: STREAK_BADGES.includes(days) && days > u.best ? days : null, freezes };
}

/** A friend joined with this user's link: one more freeze, up to the limit. True if one was given. */
export async function giveFreeze(userId: string) {
  const rows = await sql`UPDATE users SET streak_freezes = streak_freezes + 1 WHERE id = ${userId} AND streak_freezes < ${MAX_FREEZES} RETURNING id`;
  return rows.length > 0;
}

export type Streak = {
  days: number;
  best: number;
  freezes: number;
  /** Picked someone today. */
  today: boolean;
  /** Days missed since the last pick that a freeze will cover on the next one. */
  covering: number;
  /** This week, Monday first: played, frozen, missed, or a day still to come. */
  week: ("played" | "frozen" | "missed" | "today" | "future")[];
};

/** The streak as it stands now. It's alive while the missed days since the last pick fit in your freezes. */
export async function getStreak(userId: string): Promise<Streak> {
  const today = lagosDate();
  // Monday of this week (getUTCDay: 0 = Sunday).
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const [[u], days] = await Promise.all([
    sql<{ days: number; best: number; freezes: number; gap: number | null }[]>`
      SELECT streak AS days, streak_best AS best, streak_freezes AS freezes,
             (${today}::date - streak_on - 1) AS gap
      FROM users WHERE id = ${userId}
    `,
    sql<{ offset: number; frozen: boolean }[]>`
      SELECT (day - (${today}::date - ${dow}::int)) AS offset, frozen FROM streak_days
      WHERE user_id = ${userId} AND day >= ${today}::date - ${dow}::int
    `,
  ]);
  const alive = Boolean(u) && u.days > 0 && u.gap !== null && u.gap <= u.freezes;
  const byOffset = new Map(days.map((d) => [d.offset, d.frozen]));
  const week = Array.from({ length: 7 }, (_, i): Streak["week"][number] => {
    if (byOffset.has(i)) return byOffset.get(i) ? "frozen" : "played";
    if (i === dow) return "today";
    return i > dow ? "future" : "missed";
  });
  return {
    days: alive ? u.days : 0,
    best: u?.best ?? 0,
    freezes: u?.freezes ?? 0,
    today: u?.gap === -1,
    covering: alive && u.gap! > 0 ? u.gap! : 0,
    week,
  };
}
