import { sql } from "@/lib/db";
import { notifyUser } from "@/lib/challenges";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily (09:00 Lagos via vercel.json), at most one of each per person per day:
 * - "N people joined through your links" for sign-ups credited in the last 24 hours
 * - "Add your post stats" once an entry's stats are due (once per entry), for challenges that ask for them
 * - a last-day reminder when an open challenge closes within 24 hours
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const joined = await sql<{ user_id: string; slug: string; n: number }[]>`
    SELECT s.referrer_user_id AS user_id, c.slug, count(*)::int AS n
    FROM challenge_signups s JOIN challenges c ON c.id = s.challenge_id
    WHERE s.signed_up_at > now() - interval '24 hours' AND s.void_reason IS NULL AND c.status = 'open'
    GROUP BY s.referrer_user_id, c.slug
  `;
  for (const j of joined) {
    await notifyUser(
      j.user_id,
      `${j.n} ${j.n === 1 ? "person" : "people"} joined through your links today 🔥`,
      "They count once they get verified. Keep sharing!",
      `/challenges/${j.slug}/mine`,
    );
  }

  const due = await sql<{ id: number; user_id: string; slug: string }[]>`
    UPDATE challenge_entries e SET metrics_reminded_at = now()
    FROM challenges c
    WHERE c.id = e.challenge_id AND c.ask_for_stats AND c.published_at IS NULL AND c.status IN ('open', 'closed')
      AND e.status IN ('pending', 'approved') AND e.metrics_submitted_at IS NULL AND e.metrics_reminded_at IS NULL
      AND e.submitted_at + make_interval(hours => c.metrics_due_hours) <= now()
    RETURNING e.id, e.user_id, c.slug
  `;
  for (const u of new Map(due.map((d) => [d.user_id, d])).values()) {
    await notifyUser(u.user_id, "📊 Add your post stats", "Views, likes and a screenshot help us judge your entry's reach.", `/challenges/${u.slug}/mine`);
  }

  const closing = await sql<{ user_id: string; slug: string; badge_name: string }[]>`
    SELECT p.user_id, c.slug, c.badge_name FROM challenge_participants p JOIN challenges c ON c.id = p.challenge_id
    WHERE c.status = 'open' AND c.closes_at > now() AND c.closes_at <= now() + interval '24 hours'
  `;
  for (const p of closing) {
    await notifyUser(p.user_id, `⏰ Last day of ${p.badge_name}`, "Add your last entries and keep sharing your links.", `/challenges/${p.slug}/mine`);
  }

  return Response.json({ ok: true, joined: joined.length, stats: due.length, closing: closing.length });
}
