import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "./db";
import { STATES } from "./states";
import { DEFAULT_EARLY_DEADLINE, DEFAULT_LEADERBOARD_CLOSE, DEFAULT_PRIZE_TEXT, DEFAULT_REWARDS_REVEAL_TEXT } from "./config";

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

export const REWARD_SETTING_KEYS = ["early_deadline", "leaderboard_close", "rewards_reveal_text"] as const;

export type RewardSettings = {
  /** ISO time: Early Corper badge closes, predictions lock. */
  earlyDeadline: string;
  /** ISO time: leaderboards close, State Ambassadors and Prophets are picked. */
  leaderboardClose: string;
  revealText: string;
};

/** Reward countdowns and the mystery prize text, cached with the other settings. */
export const getRewardSettings = unstable_cache(
  async (): Promise<RewardSettings> => {
    const rows = await sql<{ key: string; value: string }[]>`
      SELECT key, value FROM settings WHERE key IN ${sql(REWARD_SETTING_KEYS as unknown as string[])}
    `;
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      earlyDeadline: map.get("early_deadline") || DEFAULT_EARLY_DEADLINE,
      leaderboardClose: map.get("leaderboard_close") || DEFAULT_LEADERBOARD_CLOSE,
      revealText: map.get("rewards_reveal_text") || DEFAULT_REWARDS_REVEAL_TEXT,
    };
  },
  ["reward-settings"],
  { revalidate: 60, tags: ["settings"] },
);

export const getEarlyDeadline = async () => (await getRewardSettings()).earlyDeadline;
export const getLeaderboardClose = async () => (await getRewardSettings()).leaderboardClose;
export const getRewardsRevealText = async () => (await getRewardSettings()).revealText;

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

export type Announcement = {
  title: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
};

export const ANNOUNCEMENT_KEYS = [
  "announcement_active",
  "announcement_title",
  "announcement_body",
  "announcement_button_label",
  "announcement_button_url",
] as const;

/** Raw announcement settings, for the admin form. */
export const getAnnouncementSettings = unstable_cache(
  async () => {
    const rows = await sql<{ key: string; value: string }[]>`
      SELECT key, value FROM settings WHERE key IN ${sql(ANNOUNCEMENT_KEYS as unknown as string[])}
    `;
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      active: map.get("announcement_active") === "1",
      title: map.get("announcement_title") ?? "",
      body: map.get("announcement_body") ?? "",
      buttonLabel: map.get("announcement_button_label") ?? "",
      buttonUrl: map.get("announcement_button_url") ?? "",
    };
  },
  ["announcement"],
  { revalidate: 60, tags: ["settings"] },
);

/** The Home announcement, or null when it's switched off or has no title. */
export async function getAnnouncement(): Promise<Announcement | null> {
  const a = await getAnnouncementSettings();
  if (!a.active || !a.title) return null;
  return { title: a.title, body: a.body, buttonLabel: a.buttonLabel, buttonUrl: a.buttonUrl };
}
