import { sql } from "@/lib/db";
import { ranked } from "@/lib/ranking";
import { lagosDate } from "@/lib/util";
import { campStarted, serviceOver } from "@/lib/nysc";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

/**
 * Saves everyone's position once a day (runs just after midnight Lagos time via vercel.json).
 * Home compares the live position with this snapshot to show "↑ 20 since yesterday".
 * Also moves people on in NYSC by their batch: posted → serving once camp has started, serving → served
 * once the service year is over (lib/nysc.ts).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const today = lagosDate();
  const result = await sql`
    ${ranked()}
    INSERT INTO position_snapshots (user_id, snapshot_date, position)
    SELECT id, ${today}::date, position FROM ranked
    ON CONFLICT (user_id, snapshot_date) DO UPDATE SET position = EXCLUDED.position
  `;
  await sql`DELETE FROM position_snapshots WHERE snapshot_date < (${today}::date - 60)`;

  const now = new Date();
  const people = await sql<{ id: string; nysc_stage: "posted" | "serving"; nysc_batch: string }[]>`
    SELECT id, nysc_stage, nysc_batch FROM users WHERE nysc_stage IN ('posted', 'serving') AND nysc_batch IS NOT NULL
  `;
  const toServed = people.filter((p) => serviceOver(p.nysc_batch, now)).map((p) => p.id);
  const toServing = people.filter((p) => p.nysc_stage === "posted" && campStarted(p.nysc_batch, now) && !serviceOver(p.nysc_batch, now)).map((p) => p.id);
  if (toServed.length) await sql`UPDATE users SET nysc_stage = 'served' WHERE id IN ${sql(toServed)}`;
  if (toServing.length) await sql`UPDATE users SET nysc_stage = 'serving' WHERE id IN ${sql(toServing)}`;
  if (toServed.length || toServing.length) {
    revalidateTag("stats");
    revalidateTag("league");
  }

  return Response.json({ ok: true, date: today, saved: result.count, passedOut: toServed.length, startedServing: toServing.length });
}
