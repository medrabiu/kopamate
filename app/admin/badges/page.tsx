import type { Metadata } from "next";
import Link from "next/link";
import BadgeIcon from "@/components/BadgeIcon";
import { requireAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { getTopReferrersPerState } from "@/lib/ranking";
import { getRewardSettings } from "@/lib/stats";
import { adminAwardBadge, awardProphets, runBadgeBackfill } from "@/app/actions/admin";
import { btn, btnPrimary, panel } from "../ui";

export const metadata: Metadata = { title: "Badges" };

export default async function AdminBadgesPage({ searchParams }: { searchParams: Promise<{ backfill?: string; prophet?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [settings, counts, candidates, ambassadors] = await Promise.all([
    getRewardSettings(),
    sql<{ slug: string; name: string; kind: string; held: number; revoked: number }[]>`
      SELECT b.slug, b.name, b.kind,
             count(ub.user_id) FILTER (WHERE ub.revoked_at IS NULL)::int AS held,
             count(ub.user_id) FILTER (WHERE ub.revoked_at IS NOT NULL)::int AS revoked
      FROM badges b LEFT JOIN user_badges ub ON ub.badge_slug = b.slug
      GROUP BY b.slug ORDER BY b.priority DESC
    `,
    getTopReferrersPerState(3),
    sql<{ user_id: string }[]>`SELECT user_id FROM user_badges WHERE badge_slug = 'state_ambassador' AND revoked_at IS NULL`,
  ]);
  const isAmbassador = new Set(ambassadors.map((a) => a.user_id));
  const closed = Date.now() >= new Date(settings.leaderboardClose).getTime();

  return (
    <>
      {sp.backfill && (
        <p role="status" className="rounded-2xl border border-lime p-4 text-sm">
          Backfill done: {sp.backfill} new {sp.backfill === "1" ? "badge" : "badges"} given.
        </p>
      )}
      {sp.prophet && (
        <p role="status" className="rounded-2xl border border-lime p-4 text-sm">
          {sp.prophet === "early" ? "Prophet badges can only be given after the leaderboard closes." : `Prophet given to ${sp.prophet} people.`}
        </p>
      )}

      <section className={panel}>
        <h2 className="h-display mb-3 text-lg">Badges</h2>
        <ul className="mb-4 flex flex-col gap-1 text-sm">
          {counts.map((b) => (
            <li key={b.slug} className="flex justify-between gap-3">
              <span>
                {b.name} <span className="text-muted">· {b.kind}</span>
              </span>
              <span className="text-muted">
                {b.held} held{b.revoked ? ` · ${b.revoked} revoked` : ""}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <form action={runBadgeBackfill}>
            <button className={btn}>Run badge backfill</button>
          </form>
          <form action={awardProphets}>
            <button className={btn} disabled={!closed} title={closed ? undefined : "Available after the leaderboard closes"}>
              Award Prophet badges
            </button>
          </form>
          <a href="/admin/export?list=early" className={btn}>
            Download Early Corpers (CSV)
          </a>
        </div>
        <p className="mt-2 text-xs text-muted">
          Backfill gives Early Corper, First Invite and Profile Complete to everyone who has earned them; revoked badges stay revoked.
          Prophet goes to everyone who picked the state with the most sign-ups, {closed ? "now" : "once the leaderboard closes"}.
          The CSV leaves out revoked badges and flagged, banned and seed accounts.
        </p>
      </section>

      <section className={panel}>
        <h2 className="h-display mb-1 text-lg">Ambassador candidates</h2>
        <p className="mb-3 text-xs text-muted">Top 3 referrers in each state. Flagged, banned and seed accounts are left out.</p>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted">No referrers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-surface-2">
                  <th className="p-2">State</th>
                  <th className="p-2">#</th>
                  <th className="p-2">User</th>
                  <th className="p-2">Friends</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="border-b border-surface-2">
                    <td className="p-2">{c.state_rank === 1 ? c.state : ""}</td>
                    <td className="p-2 text-muted">{c.state_rank}</td>
                    <td className="p-2">
                      <Link href={`/admin/users/${c.id}`} className="inline-flex items-center gap-1.5 font-bold hover:underline">
                        {c.nickname}
                        <BadgeIcon badge={c.top_badge} />
                      </Link>
                    </td>
                    <td className="p-2">{c.refs}</td>
                    <td className="p-2 text-right">
                      {isAmbassador.has(c.id) ? (
                        <span className="text-xs text-muted">Ambassador</span>
                      ) : (
                        <form action={adminAwardBadge}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="slug" value="state_ambassador" />
                          <button className={btnPrimary}>Award State Ambassador</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
