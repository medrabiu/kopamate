import "server-only";
import { unstable_cache } from "next/cache";
import { awardBadge } from "./badges";
import { sql } from "./db";
import { sendPush } from "./push";
import { STATES } from "./states";
import { lagosDate } from "./util";

/**
 * State League. Weeks run Monday to Sunday, Lagos time. Every Daily Quiz point a corper scores counts for
 * the state they serve in. States are ranked by points per corper (total points ÷ every corper in the
 * state), so a small state that plays hard beats a big one that doesn't, and every member counts.
 * A state needs MIN_MEMBERS corpers to be ranked. Seed accounts, flagged and banned users never score
 * and don't count as members.
 */
export const MIN_MEMBERS = 10;
/** Days played in a week to share in a Champion State badge. */
export const CHAMPION_MIN_DAYS = 3;

/** Monday (YYYY-MM-DD) of the week `day` is in. */
export function weekStart(day = lagosDate()) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** When the week starting `week` ends: the next Monday 00:00 in Lagos (UTC+1). */
export function weekEndsAt(week: string) {
  const d = new Date(`${week}T00:00:00+01:00`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString();
}

export type StateStanding = {
  state: string;
  members: number;
  /** Corpers who played at least once this week. */
  players: number;
  points: number;
  /** Points per corper, one decimal. */
  score: number;
  /** Null when the state has fewer than MIN_MEMBERS corpers. */
  rank: number | null;
};

async function loadStandings(week: string): Promise<StateStanding[]> {
  const rows = await sql<{ state: string; members: number; players: number; points: number }[]>`
    WITH pts AS (
      SELECT a.state, sum(a.points + a.bonus)::int AS points, count(DISTINCT a.user_id)::int AS players
      FROM quiz_attempts a JOIN users u ON u.id = a.user_id
      WHERE a.day >= ${week}::date AND a.day < ${week}::date + 7
        AND NOT u.is_flagged AND NOT u.is_banned AND NOT u.is_seed
      GROUP BY a.state
    ),
    mem AS (
      SELECT state, count(*)::int AS members FROM users
      WHERE completed_at IS NOT NULL AND NOT is_banned AND NOT is_seed AND state IS NOT NULL
      GROUP BY state
    )
    SELECT mem.state, mem.members, COALESCE(pts.players, 0) AS players, COALESCE(pts.points, 0) AS points
    FROM mem LEFT JOIN pts ON pts.state = mem.state
  `;
  const byState = new Map(rows.map((r) => [r.state, r]));
  const all = STATES.map((state) => {
    const r = byState.get(state) ?? { members: 0, players: 0, points: 0 };
    return { state, members: r.members, players: r.players, points: r.points, score: r.members ? Math.round((r.points / r.members) * 10) / 10 : 0 };
  });
  const ranked = all
    .filter((s) => s.members >= MIN_MEMBERS)
    .sort((a, b) => b.score - a.score || b.points - a.points || a.state.localeCompare(b.state))
    .map((s, i) => ({ ...s, rank: i + 1 }));
  const unranked = all
    .filter((s) => s.members < MIN_MEMBERS)
    .sort((a, b) => b.members - a.members || a.state.localeCompare(b.state))
    .map((s) => ({ ...s, rank: null }));
  return [...ranked, ...unranked];
}

/** The live table, cached briefly; finishing a quiz refreshes it (tag "league"). */
export const getStandings = unstable_cache(loadStandings, ["league-standings"], { revalidate: 30, tags: ["league"] });

export type PlayerRow = { id: string; nickname: string; photo_version: number; verified: boolean; state: string; points: number; days: number; rank: number };

const playerTotals = (week: string) => sql`
  SELECT a.user_id AS id, u.nickname, u.photo_version, (u.verification_status = 'verified') AS verified, a.state,
         sum(a.points + a.bonus)::int AS points, count(*)::int AS days,
         min(a.started_at) AS first_at
  FROM quiz_attempts a JOIN users u ON u.id = a.user_id
  WHERE a.day >= ${week}::date AND a.day < ${week}::date + 7
    AND NOT u.is_flagged AND NOT u.is_banned AND NOT u.is_seed
  GROUP BY a.user_id, u.nickname, u.photo_version, u.verification_status, a.state
`;

/** Top players this week, in Nigeria or one state. Ties go to whoever started playing first. */
export async function getTopPlayers(week: string, state: string | null, limit: number): Promise<PlayerRow[]> {
  return sql<PlayerRow[]>`
    SELECT id, nickname, photo_version, verified, state, points, days,
           (row_number() OVER (ORDER BY points DESC, first_at))::int AS rank
    FROM (${playerTotals(week)}) t
    WHERE ${state ? sql`state = ${state}` : sql`true`}
    ORDER BY points DESC, first_at LIMIT ${limit}
  `;
}

/** The user's place this week, nationally and in their state. Null if they haven't played. */
export async function getMyLeagueRank(week: string, userId: string) {
  const [row] = await sql<{ points: number; days: number; national: number; in_state: number }[]>`
    SELECT points, days, national, in_state FROM (
      SELECT id, points, days,
             (row_number() OVER (ORDER BY points DESC, first_at))::int AS national,
             (row_number() OVER (PARTITION BY state ORDER BY points DESC, first_at))::int AS in_state
      FROM (${playerTotals(week)}) t
    ) r WHERE id = ${userId}
  `;
  return row ?? null;
}

/**
 * Closes a finished week once: saves the table, gives Champion State to everyone in the winning state
 * who played CHAMPION_MIN_DAYS days, Quiz MVP to the top player, and tells this week's players how it went.
 */
export async function closeWeek(week: string) {
  const [done] = await sql`SELECT 1 FROM league_weeks WHERE week = ${week}::date`;
  if (done) return { week, alreadyClosed: true };

  const standings = await loadStandings(week);
  const winner = standings.find((s) => s.rank === 1 && s.points > 0) ?? null;
  const top = await getTopPlayers(week, null, 10);
  const inserted = await sql`
    INSERT INTO league_weeks (week, winner_state, standings, top_players)
    VALUES (${week}::date, ${winner?.state ?? null}, ${sql.json(standings as never)}, ${sql.json(top as never)})
    ON CONFLICT DO NOTHING RETURNING week
  `;
  if (inserted.length === 0) return { week, alreadyClosed: true };

  let champions: string[] = [];
  if (winner) {
    const rows = await sql<{ id: string }[]>`
      SELECT a.user_id AS id FROM quiz_attempts a JOIN users u ON u.id = a.user_id
      WHERE a.day >= ${week}::date AND a.day < ${week}::date + 7 AND a.state = ${winner.state}
        AND NOT u.is_flagged AND NOT u.is_banned AND NOT u.is_seed
      GROUP BY a.user_id HAVING count(*) >= ${CHAMPION_MIN_DAYS}
    `;
    champions = rows.map((r) => r.id);
    for (const id of champions) await awardBadge(id, "champion_state");
  }
  if (top[0]?.points > 0) await awardBadge(top[0].id, "quiz_mvp");

  // Everyone who played: one push per state with where it finished.
  const players = await sql<{ id: string; state: string }[]>`
    SELECT DISTINCT a.user_id AS id, a.state FROM quiz_attempts a
    WHERE a.day >= ${week}::date AND a.day < ${week}::date + 7
  `;
  const rankOf = new Map(standings.map((s) => [s.state, s.rank]));
  const byState = new Map<string, string[]>();
  for (const p of players) byState.set(p.state, [...(byState.get(p.state) ?? []), p.id]);
  for (const [state, ids] of byState) {
    const rank = rankOf.get(state);
    const title = winner ? (winner.state === state ? `🏆 ${state} won the week!` : `🏆 ${winner.state} won the week`) : "🏆 The League week is over";
    const body =
      winner?.state === state
        ? "Champion State badges are out. A new week starts now: defend the title."
        : rank
          ? `${state} finished #${rank}. A new week starts now.`
          : `${state} needs ${MIN_MEMBERS} corpers to be ranked. Invite friends and climb this week.`;
    await sendPush(ids, { title, body, url: "/league", tag: "league" });
  }
  return { week, winner: winner?.state ?? null, champions: champions.length, mvp: top[0]?.nickname ?? null };
}
