import { sql, transaction } from "@/lib/db";
import { addDays } from "@/lib/hustle/data";
import { closeAll } from "@/lib/hustle/day";
import { getHustleSettings } from "@/lib/hustle/settings";
import { lagosMonth, payAllawee } from "@/lib/hustle/wallet";
import { lagosDate } from "@/lib/util";

export const dynamic = "force-dynamic";
// 60 s fits every Vercel plan, with or without Fluid compute. Each step stops starting new work before then;
// anything left is idempotent and finishes on the next run (or when the player opens My Hustle).
export const maxDuration = 60;
const BUDGET_MS = 40_000;

/**
 * My Hustle's nightly jobs, chained in one route (runs 00:05 Lagos via vercel.json):
 * 1. closes yesterday for every business (spoilage, rent, profit, tips; credit due; expired stock; restructures),
 * 2. pays this month's Allawee to every wallet that hasn't had it (so it lands on the 1st, and catches up if a
 *    run was missed),
 * 3. tells players about needs running out in the next day (runs once a day, so once per need).
 * Every step is idempotent, so running it twice, or late, is safe. Pages also close a player's own past days
 * when they visit, so nobody waits on this job.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const started = Date.now();
  // "Yesterday" is worked out when the job runs, so a late run (Hobby fires up to 59 minutes after the hour)
  // still closes the right day, and a missed night is caught up next time.
  const yesterday = addDays(lagosDate(), -1);
  const closed = await closeAll(yesterday, BUDGET_MS);

  const s = await getHustleSettings();
  const month = lagosMonth();
  const owed = await sql<{ user_id: string }[]>`
    SELECT user_id FROM hustle_wallets WHERE last_allawee_month IS NULL OR last_allawee_month < ${month}
  `;
  let allawee = 0;
  for (const { user_id } of owed) {
    if (Date.now() - started > BUDGET_MS + 10_000) break;
    if (await transaction((tx) => payAllawee(tx, user_id, s.allawee, month))) allawee++;
  }
  // A need running out in the next day (food is daily, so it's left out): one note per need.
  const due = await sql`
    INSERT INTO notifications (user_id, kind, title, body, url)
    SELECT n.user_id, 'hustle', 'Your ' || CASE n.need_key WHEN 'grooming' THEN 'hair' ELSE n.need_key END || ' is due soon',
      'Buy from a player in the Market to keep your Vibe up.', '/hustle/market?need=' || n.need_key
    FROM hustle_needs n JOIN users u ON u.id = n.user_id
    WHERE n.need_key <> 'food' AND NOT u.is_banned
      AND n.satisfied_until BETWEEN now() AND now() + interval '1 day'
      -- A rerun the same day doesn't send it twice.
      AND NOT EXISTS (
        SELECT 1 FROM notifications x WHERE x.user_id = n.user_id AND x.kind = 'hustle'
          AND x.url = '/hustle/market?need=' || n.need_key AND x.created_at > now() - interval '20 hours'
      )
    RETURNING 1
  `;
  return Response.json({ ok: true, yesterday, ...closed, allawee, needsDue: due.length });
}
