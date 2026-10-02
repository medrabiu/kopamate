import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { getPublicStats } from "@/lib/stats";
import { formatNumber } from "@/lib/util";
import { panel } from "./ui";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  await requireAdmin();
  const [stats, overview, daily] = await Promise.all([
    getPublicStats(),
    sql<
      {
        referred: number;
        completed: number;
        referrers: number;
        incomplete: number;
        seed: number;
        verified: number;
        pending_verification: number;
        pending_rewards: number;
      }[]
    >`
      SELECT count(*) FILTER (WHERE referred_by IS NOT NULL AND completed_at IS NOT NULL AND NOT is_seed)::int AS referred,
             count(*) FILTER (WHERE completed_at IS NOT NULL AND NOT is_seed)::int AS completed,
             count(DISTINCT referred_by) FILTER (WHERE completed_at IS NOT NULL AND NOT is_seed)::int AS referrers,
             count(*) FILTER (WHERE completed_at IS NULL)::int AS incomplete,
             count(*) FILTER (WHERE is_seed)::int AS seed,
             count(*) FILTER (WHERE verification_status = 'verified')::int AS verified,
             count(*) FILTER (WHERE verification_status = 'pending')::int AS pending_verification,
             (SELECT count(*)::int FROM rewards WHERE status IN ('claimed', 'processing')) AS pending_rewards
      FROM users WHERE NOT is_banned
    `,
    sql<{ day: string; n: number }[]>`
      SELECT to_char(d, 'DD Mon') AS day,
             (SELECT count(*) FROM users u
              WHERE u.completed_at IS NOT NULL AND NOT u.is_banned AND NOT u.is_seed
                AND (u.completed_at AT TIME ZONE 'Africa/Lagos')::date = d::date)::int AS n
      FROM generate_series((now() AT TIME ZONE 'Africa/Lagos')::date - 13, (now() AT TIME ZONE 'Africa/Lagos')::date, interval '1 day') d
      ORDER BY d
    `,
  ]);

  const o = overview[0];
  const pctReferred = o.completed ? Math.round((o.referred / o.completed) * 100) : 0;
  const avgRefs = o.referrers ? (o.referred / o.referrers).toFixed(1) : "0";
  const maxDay = Math.max(1, ...daily.map((d) => d.n));

  return (
    <>
      {(o.pending_verification > 0 || o.pending_rewards > 0) && (
        <section className="flex flex-wrap gap-3">
          {o.pending_verification > 0 && (
            <Link href="/admin/verification" className="rounded-2xl border border-lime px-4 py-3 text-sm font-bold">
              {o.pending_verification} verification {o.pending_verification === 1 ? "request" : "requests"} waiting
            </Link>
          )}
          {o.pending_rewards > 0 && (
            <Link href="/admin/rewards" className="rounded-2xl border border-pink px-4 py-3 text-sm font-bold">
              {o.pending_rewards} {o.pending_rewards === 1 ? "payout" : "payouts"} to send
            </Link>
          )}
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Corpers joined (shown publicly)", formatNumber(stats.total)],
          ["Real users", formatNumber(o.completed)],
          ["Seed accounts", formatNumber(o.seed)],
          ["Joined today", formatNumber(stats.today)],
          ["From referrals", `${pctReferred}%`],
          ["Avg referrals per referrer", avgRefs],
          ["Verified", formatNumber(o.verified)],
          ["Unfinished Google sign-ups", formatNumber(o.incomplete)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line p-4">
            <div className="text-xs text-muted">{label}</div>
            <div className="h-display mt-1 text-2xl">{value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className={panel}>
          <h2 className="h-display mb-3 text-lg">Real sign-ups, last 14 days</h2>
          <ul className="flex flex-col gap-1.5">
            {daily.map((d) => (
              <li key={d.day} className="flex items-center gap-3 text-sm">
                <span className="w-14 shrink-0 text-muted">{d.day}</span>
                <span className="h-3 rounded-sm bg-lime" style={{ width: `${(d.n / maxDay) * 70}%`, minWidth: d.n ? 3 : 0 }} />
                <span className="text-muted">{d.n}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={panel}>
          <h2 className="h-display mb-3 text-lg">Top states</h2>
          <ol className="flex flex-col gap-1 text-sm">
            {stats.states.slice(0, 10).map((s) => (
              <li key={s.state} className="flex justify-between">
                <span>
                  {s.rank}. {s.state}
                </span>
                <span className="text-muted">{formatNumber(s.count)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
