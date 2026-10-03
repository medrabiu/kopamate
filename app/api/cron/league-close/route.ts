import { closeWeek, weekStart } from "@/lib/league";
import { lagosDate } from "@/lib/util";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Closes last week's State League (runs Monday 00:10 Lagos via vercel.json): saves the final table, gives out
 * Champion State and Quiz MVP badges, and tells the players. Safe to run twice; never closes the current week.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const week = weekStart(lagosDate(new Date(Date.now() - 86400_000)));
  if (week === weekStart()) return Response.json({ ok: false, reason: "this week is still running", week });
  return Response.json({ ok: true, ...(await closeWeek(week)) });
}
