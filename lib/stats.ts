import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "./db";
import { STATES } from "./states";
import { DEFAULT_PRIZE_TEXT } from "./config";

export type StateCount = { state: string; count: number; rank: number };

export type PublicStats = {
  total: number;
  today: number;
  states: StateCount[]; // every state, sorted by count (zeros last, alphabetical)
  activeStates: number;
};

async function loadStats(): Promise<PublicStats> {
  const [totals] = await sql<{ total: number; today: number }[]>`
    SELECT count(*)::int AS total,
           count(*) FILTER (
             WHERE (completed_at AT TIME ZONE 'Africa/Lagos')::date = (now() AT TIME ZONE 'Africa/Lagos')::date
           )::int AS today
    FROM users WHERE completed_at IS NOT NULL AND NOT is_banned
  `;
  const rows = await sql<{ state: string; count: number }[]>`
    SELECT state, count(*)::int AS count
    FROM users WHERE completed_at IS NOT NULL AND NOT is_banned AND state IS NOT NULL
    GROUP BY state
  `;
  const map = new Map(rows.map((r) => [r.state, r.count]));
  const sorted = STATES.map((state) => ({ state, count: map.get(state) ?? 0 })).sort(
    (a, b) => b.count - a.count || a.state.localeCompare(b.state),
  );
  const states = sorted.map((s, i) => ({ ...s, rank: i + 1 }));
  return {
    total: totals?.total ?? 0,
    today: totals?.today ?? 0,
    states,
    activeStates: states.filter((s) => s.count > 0).length,
  };
}

/** Public numbers, cached for 30 seconds so busy pages don't hammer the database. */
export const getPublicStats = unstable_cache(loadStats, ["public-stats"], { revalidate: 30, tags: ["stats"] });

export async function getSetting(key: string): Promise<string | null> {
  const rows = await sql<{ value: string }[]>`SELECT value FROM settings WHERE key = ${key}`;
  return rows[0]?.value ?? null;
}

export const getPrizeText = unstable_cache(
  async () => (await getSetting("prize_teaser_text")) || DEFAULT_PRIZE_TEXT,
  ["prize-text"],
  { revalidate: 60, tags: ["settings"] },
);

/** "position" (default) or "signup": how the first-500 prize is counted. */
export async function getFirstNMode(): Promise<"position" | "signup"> {
  return (await getSetting("first_n_mode")) === "signup" ? "signup" : "position";
}

export async function track(name: string, userId: string | null, meta?: Record<string, unknown>) {
  try {
    await sql`INSERT INTO events (name, user_id, meta) VALUES (${name}, ${userId}, ${meta ? sql.json(meta as never) : null})`;
  } catch {
    // Analytics must never break a page.
  }
}
