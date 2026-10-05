import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { formatNumber } from "@/lib/util";
import { panel } from "../ui";

export const metadata: Metadata = { title: "Usage" };

/** Real users only: finished sign-up, not seed, banned or flagged. */
const real = sql`completed_at IS NOT NULL AND NOT is_seed AND NOT is_banned AND NOT is_flagged`;

/**
 * Who was active on which Lagos day: opened Home (the daily_return event) or started the Daily Quiz.
 * Quiz counts too because a push can take someone straight to the quiz without passing Home.
 * The last 70 days is all any section needs (the oldest sign-up week starts at most 62 days back).
 */
const activity = sql`
  activity AS (
    SELECT DISTINCT a.user_id, a.day FROM (
      SELECT user_id, (created_at AT TIME ZONE 'Africa/Lagos')::date AS day FROM events
      WHERE name = 'daily_return' AND user_id IS NOT NULL AND created_at > now() - interval '70 days'
      UNION ALL
      SELECT user_id, day FROM quiz_attempts WHERE day > CURRENT_DATE - 71
    ) a JOIN users u ON u.id = a.user_id WHERE ${real}
  )
`;

const today = sql`(now() AT TIME ZONE 'Africa/Lagos')::date`;

const STAGES: Record<string, string> = {
  waiting: "Awaiting call-up",
  posted: "Got call-up",
  serving: "Serving",
  served: "Passed out",
};

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "–");

export default async function AdminUsagePage() {
  await requireAdmin();
  const [[totals], daily, cohorts, features, stages] = await Promise.all([
    sql<{ users: number; dau: number; wau: number; mau: number; push: number }[]>`
      WITH ${activity}
      SELECT (SELECT count(*) FROM users WHERE ${real})::int AS users,
             count(DISTINCT user_id) FILTER (WHERE day = ${today})::int AS dau,
             count(DISTINCT user_id) FILTER (WHERE day > ${today} - 7)::int AS wau,
             count(DISTINCT user_id) FILTER (WHERE day > ${today} - 30)::int AS mau,
             (SELECT count(DISTINCT p.user_id) FROM push_subscriptions p JOIN users u ON u.id = p.user_id WHERE ${real})::int AS push
      FROM activity WHERE day > ${today} - 30
    `,
    sql<{ day: string; active: number; quiz: number }[]>`
      WITH ${activity}
      SELECT to_char(d, 'DD Mon') AS day,
             count(a.user_id)::int AS active,
             count(q.user_id)::int AS quiz
      FROM generate_series(${today} - 29, ${today}, interval '1 day') d
      LEFT JOIN activity a ON a.day = d::date
      LEFT JOIN quiz_attempts q ON q.user_id = a.user_id AND q.day = a.day
      GROUP BY d
      ORDER BY d DESC
    `,
    // Weekly sign-up cohorts (weeks start Monday). Each return figure only counts people who have had
    // long enough since signing up, so a recent week isn't dragged down by people who couldn't return yet.
    sql<
      {
        week: string;
        signups: number;
        d1_of: number;
        d1: number;
        w2_of: number;
        w2: number;
        d30_of: number;
        d30: number;
      }[]
    >`
      WITH ${activity},
      cohort AS (
        SELECT id, (completed_at AT TIME ZONE 'Africa/Lagos')::date AS joined FROM users
        WHERE ${real} AND (completed_at AT TIME ZONE 'Africa/Lagos')::date >= date_trunc('week', ${today}) - interval '8 weeks'
      ),
      flags AS (
        SELECT c.joined,
               coalesce(bool_or(a.day = c.joined + 1), false) AS d1,
               coalesce(bool_or(a.day BETWEEN c.joined + 7 AND c.joined + 13), false) AS w2,
               coalesce(bool_or(a.day >= c.joined + 30), false) AS d30
        FROM cohort c LEFT JOIN activity a ON a.user_id = c.id AND a.day > c.joined
        GROUP BY c.id, c.joined
      )
      SELECT to_char(date_trunc('week', joined), 'DD Mon') AS week,
             count(*)::int AS signups,
             count(*) FILTER (WHERE joined + 1 < ${today})::int AS d1_of,
             count(*) FILTER (WHERE joined + 1 < ${today} AND d1)::int AS d1,
             count(*) FILTER (WHERE joined + 13 < ${today})::int AS w2_of,
             count(*) FILTER (WHERE joined + 13 < ${today} AND w2)::int AS w2,
             count(*) FILTER (WHERE joined + 30 <= ${today})::int AS d30_of,
             count(*) FILTER (WHERE joined + 30 <= ${today} AND d30)::int AS d30
      FROM flags
      GROUP BY date_trunc('week', joined)
      ORDER BY date_trunc('week', joined) DESC
    `,
    sql<{ active: number; quiz: number; finished: number; followed: number; invited: number; pushed: number }[]>`
      WITH ${activity},
      week AS (SELECT DISTINCT user_id FROM activity WHERE day > ${today} - 7)
      SELECT (SELECT count(*) FROM week)::int AS active,
             (SELECT count(DISTINCT q.user_id) FROM quiz_attempts q JOIN week w USING (user_id) WHERE q.day > ${today} - 7)::int AS quiz,
             (SELECT count(DISTINCT q.user_id) FROM quiz_attempts q JOIN week w USING (user_id)
              WHERE q.day > ${today} - 7 AND q.finished_at IS NOT NULL)::int AS finished,
             (SELECT count(DISTINCT f.follower_id) FROM follows f JOIN week w ON w.user_id = f.follower_id
              WHERE f.created_at > now() - interval '7 days')::int AS followed,
             (SELECT count(DISTINCT u.referred_by) FROM users u JOIN week w ON w.user_id = u.referred_by
              WHERE u.completed_at > now() - interval '7 days' AND NOT u.is_seed)::int AS invited,
             (SELECT count(DISTINCT p.user_id) FROM push_subscriptions p JOIN week w USING (user_id))::int AS pushed
    `,
    sql<{ stage: string; users: number; active: number }[]>`
      WITH ${activity},
      week AS (SELECT DISTINCT user_id FROM activity WHERE day > ${today} - 7)
      SELECT u.nysc_stage AS stage, count(*)::int AS users, count(w.user_id)::int AS active
      FROM users u LEFT JOIN week w ON w.user_id = u.id
      WHERE ${real}
      GROUP BY u.nysc_stage
      ORDER BY array_position(ARRAY['waiting', 'posted', 'serving', 'served'], u.nysc_stage)
    `,
  ]);

  const [f] = features;
  const maxDay = Math.max(1, ...daily.map((d) => d.active));

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Active today", formatNumber(totals.dau)],
          ["Active last 7 days", formatNumber(totals.wau)],
          ["Active last 30 days", formatNumber(totals.mau)],
          ["Daily / monthly (stickiness)", pct(totals.dau, totals.mau)],
          ["Push notifications on", `${formatNumber(totals.push)} · ${pct(totals.push, totals.users)}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line p-4">
            <div className="text-xs text-muted">{label}</div>
            <div className="h-display mt-1 text-2xl">{value}</div>
          </div>
        ))}
      </section>
      <p className="-mt-3 text-xs text-muted">
        Active means opened Home or started the Daily Quiz that day (Lagos time). Real users only: no seed, banned or flagged
        accounts. {formatNumber(totals.users)} real users in all.
      </p>

      <section className={panel}>
        <h2 className="h-display text-lg">Do new users come back?</h2>
        <p className="mb-3 text-sm text-muted">
          People grouped by the week they joined. Each figure only counts people who joined long enough ago to have had the chance.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1.5 pr-3 font-normal">Week of</th>
                <th className="py-1.5 pr-3 text-right font-normal">Joined</th>
                <th className="py-1.5 pr-3 text-right font-normal">Next day</th>
                <th className="py-1.5 pr-3 text-right font-normal">Second week</th>
                <th className="py-1.5 text-right font-normal">After 30 days</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.week} className="border-t border-line">
                  <td className="py-2 pr-3">{c.week}</td>
                  <td className="py-2 pr-3 text-right">{formatNumber(c.signups)}</td>
                  <td className="py-2 pr-3 text-right font-bold">{pct(c.d1, c.d1_of)}</td>
                  <td className="py-2 pr-3 text-right font-bold">{pct(c.w2, c.w2_of)}</td>
                  <td className="py-2 text-right font-bold">{pct(c.d30, c.d30_of)}</td>
                </tr>
              ))}
              {cohorts.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-muted">
                    No sign-ups in the last 9 weeks.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          Next day: active the day after joining. Second week: active on any of days 7–13. After 30 days: active on day 30 or later.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className={panel}>
          <h2 className="h-display mb-1 text-lg">What active users did, last 7 days</h2>
          <p className="mb-3 text-sm text-muted">Out of {formatNumber(f.active)} people active this week.</p>
          <ul className="flex flex-col gap-2 text-sm">
            {[
              ["Started the Daily Quiz", f.quiz],
              ["Finished the Daily Quiz", f.finished],
              ["Followed someone", f.followed],
              ["Brought in a friend", f.invited],
              ["Have push notifications on", f.pushed],
            ].map(([label, n]) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex-1">{label}</span>
                <span className="text-muted">{formatNumber(n as number)}</span>
                <span className="w-11 text-right font-bold">{pct(n as number, f.active)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">The State League is scored from the Daily Quiz, so quiz players are League players.</p>
        </div>

        <div className={panel}>
          <h2 className="h-display mb-1 text-lg">Users by NYSC stage</h2>
          <p className="mb-3 text-sm text-muted">How many are in each stage, and how many of them were active this week.</p>
          <ul className="flex flex-col gap-2 text-sm">
            {stages.map((s) => (
              <li key={s.stage} className="flex items-center gap-3">
                <span className="flex-1">{STAGES[s.stage] ?? s.stage}</span>
                <span className="text-muted">{formatNumber(s.users)}</span>
                <span className="w-24 text-right">
                  <span className="font-bold">{formatNumber(s.active)}</span> <span className="text-muted">active</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={panel}>
        <h2 className="h-display mb-3 text-lg">Active users, last 30 days</h2>
        <ul className="flex flex-col gap-1.5">
          {daily.map((d) => (
            <li key={d.day} className="flex items-center gap-3 text-sm">
              <span className="w-14 shrink-0 text-muted">{d.day}</span>
              <span className="h-3 rounded-sm bg-lime" style={{ width: `${(d.active / maxDay) * 70}%`, minWidth: d.active ? 3 : 0 }} />
              <span className="text-muted">
                {d.active}
                {d.quiz > 0 && <span className="text-faint"> · {d.quiz} quiz</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
