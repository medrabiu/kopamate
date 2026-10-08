import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily (10:30 Lagos via vercel.json):
 * - "Someone from your school joined: Ada", or grouped "3 people from UNILAG joined", at most one a day per
 *   person. Only people who added their school in the last day and have "Show me in the list" on are counted;
 *   hidden, flagged and banned people never trigger or appear in it, and blocks either way are respected.
 * - Deletes notifications older than 90 days.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sent = await sql`
    WITH newcomers AS (
      SELECT id, nickname, school FROM users
      WHERE school_set_at > now() - interval '24 hours' AND school IS NOT NULL AND show_in_list
        AND completed_at IS NOT NULL AND NOT is_banned AND NOT is_flagged
    ),
    pairs AS (
      SELECT r.id AS recipient, n.id AS newcomer, n.nickname, n.school, n.id::text AS sort
      FROM users r JOIN newcomers n ON lower(n.school) = lower(r.school) AND n.id <> r.id
      WHERE r.completed_at IS NOT NULL AND NOT r.is_banned
        AND NOT EXISTS (SELECT 1 FROM blocks bl WHERE (bl.blocker_id = r.id AND bl.blocked_id = n.id) OR (bl.blocker_id = n.id AND bl.blocked_id = r.id))
        AND NOT EXISTS (SELECT 1 FROM notifications x WHERE x.user_id = r.id AND x.kind = 'school_joined' AND x.created_at > now() - interval '20 hours')
    ),
    grouped AS (
      SELECT recipient, min(school) AS school, count(*)::int AS n,
             (array_agg(newcomer ORDER BY sort))[1] AS one_id, (array_agg(nickname ORDER BY sort))[1] AS one_nick
      FROM pairs GROUP BY recipient
    )
    INSERT INTO notifications (user_id, kind, title, url, actor_id)
    SELECT recipient, 'school_joined',
           CASE WHEN n = 1 THEN 'Someone from your school joined: ' || one_nick ELSE n || ' people from ' || school || ' joined' END,
           CASE WHEN n = 1 THEN '/u/@' || one_nick ELSE '/corpers?school=' || replace(school, ' ', '+') END,
           CASE WHEN n = 1 THEN one_id END
    FROM grouped
    RETURNING 1
  `;
  const old = await sql`DELETE FROM notifications WHERE created_at < now() - interval '90 days' RETURNING 1`;
  return Response.json({ ok: true, school_joined: sent.length, deleted: old.length });
}
