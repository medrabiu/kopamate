import { sql } from "@/lib/db";
import { pushEnabled, sendPush } from "@/lib/push";
import { lagosDate } from "@/lib/util";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Evening reminder (19:00 Lagos via vercel.json) for everyone with notifications on whose streak is
 * still alive but who hasn't picked anyone today. Same rule as getStreak in lib/streaks.ts.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!pushEnabled) return Response.json({ ok: true, sent: 0, reason: "push not configured" });

  const today = lagosDate();
  const users = await sql<{ id: string; days: number; covering: boolean }[]>`
    SELECT u.id, u.streak AS days, (${today}::date - u.streak_on - 1) > 0 AS covering
    FROM users u
    WHERE u.streak > 0 AND NOT u.is_banned
      AND u.streak_on < ${today}::date
      AND (${today}::date - u.streak_on - 1) <= u.streak_freezes
      AND EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = u.id)
  `;

  let sent = 0;
  // A few at a time, so a big list doesn't open hundreds of connections at once.
  for (let i = 0; i < users.length; i += 25) {
    const batch = users.slice(i, i + 25);
    const counts = await Promise.all(
      batch.map((u) =>
        sendPush(u.id, {
          title: `🔥 Your ${u.days}-day streak ends at midnight`,
          body: u.covering ? "You missed a day. Play today and a freeze keeps it alive." : "Today's quiz keeps it alive. It takes a minute.",
          url: "/home",
          tag: "streak",
        }),
      ),
    );
    sent += counts.reduce((a, b) => a + b, 0);
  }
  return Response.json({ ok: true, date: today, users: users.length, sent });
}
