import { sql } from "@/lib/db";
import { ranked } from "@/lib/ranking";
import { lagosDate } from "@/lib/util";

export const dynamic = "force-dynamic";

/**
 * Saves everyone's position once a day (runs just after midnight Lagos time via vercel.json).
 * Home compares the live position with this snapshot to show "↑ 20 since yesterday".
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
  return Response.json({ ok: true, date: today, saved: result.count });
}
