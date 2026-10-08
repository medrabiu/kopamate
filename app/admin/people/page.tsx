import type { Metadata } from "next";
import Link from "next/link";
import { peopleAction } from "@/app/actions/admin-people";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { REPORT_REASON_LABEL, type ReportReason } from "@/lib/social-rules";
import { timeAgo } from "@/lib/util";
import { btn, panel } from "../ui";

export const metadata: Metadata = { title: "People" };

const EVENTS = [
  "profile_view",
  "profile_edit",
  "follow",
  "unfollow",
  "hi_sent",
  "hi_accepted",
  "wa_open",
  "people_like_you_click",
  "search_used",
  "notification_open",
] as const;

const MESSAGES: Record<string, string> = {
  close_report: "Report closed.",
  clear_bio: "Bio cleared.",
  hide: "Hidden from lists.",
  ban: "Banned and logged out.",
  unflag: "Flag removed.",
  invalid: "That didn't work.",
};

type Person = { id: string; nickname: string; bio: string | null; school: string | null; show_in_list: boolean; is_banned: boolean; is_flagged: boolean };

function Actions({ p, reportId }: { p: Person; reportId?: number }) {
  const act = (action: string, label: string, show = true) =>
    show && (
      <form action={peopleAction}>
        <input type="hidden" name="action" value={action} />
        <input type="hidden" name="target" value={p.id} />
        {reportId && <input type="hidden" name="report" value={reportId} />}
        <button className={btn}>{label}</button>
      </form>
    );
  return (
    <div className="flex flex-wrap gap-1.5">
      {reportId && act("close_report", "Close report")}
      {act("clear_bio", "Clear bio", Boolean(p.bio))}
      {act("hide", "Hide from list", p.show_in_list)}
      {act("ban", "Ban", !p.is_banned)}
      {act("unflag", "Unflag", p.is_flagged)}
    </div>
  );
}

function Who({ p, label }: { p: Person; label: string }) {
  return (
    <span className="text-sm">
      <span className="text-muted">{label} </span>
      <Link href={`/admin/users/${p.id}`} className="font-bold underline">
        {p.nickname}
      </Link>
      {p.is_banned && <span className="text-pink-ink"> · banned</span>}
      {p.is_flagged && <span className="text-pink-ink"> · flagged</span>}
      {!p.show_in_list && <span className="text-muted"> · hidden</span>}
    </span>
  );
}

/** Reports, flagged accounts and the people numbers. */
export default async function AdminPeoplePage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const person = (alias: string) => sql`json_build_object('id', ${sql(alias)}.id, 'nickname', ${sql(alias)}.nickname, 'bio', ${sql(alias)}.bio,
    'school', ${sql(alias)}.school, 'show_in_list', ${sql(alias)}.show_in_list, 'is_banned', ${sql(alias)}.is_banned, 'is_flagged', ${sql(alias)}.is_flagged)`;
  const [reports, flagged, counts] = await Promise.all([
    sql<{ id: number; reason: ReportReason; note: string | null; created_at: Date; reporter: Person; target: Person; reports_on_target: number }[]>`
      SELECT r.id::int, r.reason, r.note, r.created_at, ${person("rp")} AS reporter, ${person("t")} AS target,
             (SELECT count(*)::int FROM reports x WHERE x.target_id = r.target_id AND x.status = 'open') AS reports_on_target
      FROM reports r JOIN users rp ON rp.id = r.reporter_id JOIN users t ON t.id = r.target_id
      WHERE r.status = 'open' ORDER BY r.created_at LIMIT 200
    `,
    sql<(Person & { ignored: number; accepted: number })[]>`
      SELECT u.id, u.nickname, u.bio, u.school, u.show_in_list, u.is_banned, u.is_flagged,
             (SELECT count(*)::int FROM connections c WHERE c.from_id = u.id AND c.status = 'declined') AS ignored,
             (SELECT count(*)::int FROM connections c WHERE c.from_id = u.id AND c.status = 'accepted') AS accepted
      FROM users u WHERE u.is_flagged AND NOT u.is_banned ORDER BY u.created_at DESC LIMIT 200
    `,
    sql<{ name: string; d7: number; d30: number }[]>`
      SELECT name, count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS d7, count(*)::int AS d30
      FROM events WHERE name IN ${sql(EVENTS)} AND created_at > now() - interval '30 days' GROUP BY name
    `,
  ]);
  const byName = new Map(counts.map((c) => [c.name, c]));

  return (
    <>
      {msg && MESSAGES[msg] && (
        <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${msg === "invalid" ? "border-pink" : "border-lime"}`}>
          {MESSAGES[msg]}
        </p>
      )}

      <section className={panel}>
        <h2 className="h-display mb-3 text-lg">Open reports ({reports.length})</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-muted">No open reports.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="rounded-full bg-pink px-2 py-0.5 text-xs font-bold text-on-accent">{REPORT_REASON_LABEL[r.reason]}</span>
                  <Who p={r.target} label="Reported:" />
                  <Who p={r.reporter} label="by" />
                  <span className="text-xs text-muted">
                    {timeAgo(r.created_at)}
                    {r.reports_on_target > 1 ? ` · ${r.reports_on_target} open reports on this person` : ""}
                  </span>
                </div>
                {r.note && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">“{r.note}”</p>}
                {r.target.bio && <p className="text-sm text-muted">Their bio: “{r.target.bio}”</p>}
                <Actions p={r.target} reportId={r.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panel}>
        <h2 className="h-display mb-1 text-lg">Flagged accounts ({flagged.length})</h2>
        <p className="mb-3 text-xs text-muted">Flagged by the team, the duplicate checks, or automatically when 20+ of their hellos were ignored with under 10% accepted.</p>
        {flagged.length === 0 ? (
          <p className="text-sm text-muted">Nobody is flagged.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {flagged.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <Who p={p} label="" />
                  <span className="text-xs text-muted">
                    Hellos: {p.accepted} accepted · {p.ignored} ignored
                  </span>
                </div>
                {p.bio && <p className="text-sm text-muted">Bio: “{p.bio}”</p>}
                <Actions p={p} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panel}>
        <h2 className="h-display mb-2 text-lg">Numbers</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 font-normal">Event</th>
              <th className="py-1 text-right font-normal">Last 7 days</th>
              <th className="py-1 text-right font-normal">Last 30 days</th>
            </tr>
          </thead>
          <tbody>
            {EVENTS.map((e) => (
              <tr key={e} className="border-t border-line">
                <td className="py-1.5">{e}</td>
                <td className="py-1.5 text-right">{byName.get(e)?.d7 ?? 0}</td>
                <td className="py-1.5 text-right">{byName.get(e)?.d30 ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
