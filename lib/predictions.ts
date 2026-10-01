import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "./db";

export type PredictionResults = { total: number; states: { state: string; votes: number }[] };

/** Votes per state, most first. Cached for 30 seconds; a new vote refreshes it (tag "predictions"). */
export const getPredictionResults = unstable_cache(
  async (): Promise<PredictionResults> => {
    const rows = await sql<{ state: string; votes: number }[]>`
      SELECT p.state, count(*)::int AS votes
      FROM state_predictions p JOIN users u ON u.id = p.user_id
      WHERE NOT u.is_banned
      GROUP BY p.state ORDER BY votes DESC, p.state
    `;
    return { total: rows.reduce((n, r) => n + r.votes, 0), states: rows };
  },
  ["prediction-results"],
  { revalidate: 30, tags: ["predictions"] },
);

export async function getUserPrediction(userId: string): Promise<string | null> {
  const rows = await sql<{ state: string }[]>`SELECT state FROM state_predictions WHERE user_id = ${userId}`;
  return rows[0]?.state ?? null;
}
