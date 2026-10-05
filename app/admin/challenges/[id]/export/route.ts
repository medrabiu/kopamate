import { getCurrentUser, isAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { countedSql } from "@/lib/challenge-signups";
import { APP_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

function csv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
    // Prevent spreadsheet formula injection from typed text.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

/**
 * One row per entry, for deciding winners offline: entrant, handles, links, sign-ups and post stats.
 * Person totals include sign-ups through their normal invite link. No phone numbers or emails.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return new Response("Not found", { status: 404 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });
  const [c] = await sql<{ slug: string }[]>`SELECT slug FROM challenges WHERE id = ${id}`;
  if (!c) return new Response("Not found", { status: 404 });

  const rows = await sql`
    WITH per_entry AS (
      SELECT s.entry_id, count(*)::int AS joined,
             count(*) FILTER (WHERE s.void_reason IS NULL AND nu.verification_status = 'verified')::int AS verified,
             count(*) FILTER (WHERE ${countedSql(sql)})::int AS counted,
             count(*) FILTER (WHERE s.void_reason IS NOT NULL)::int AS voided
      FROM challenge_signups s JOIN users nu ON nu.id = s.new_user_id JOIN challenges c ON c.id = s.challenge_id
      WHERE s.challenge_id = ${id} AND s.entry_id IS NOT NULL GROUP BY s.entry_id
    ),
    per_person AS (
      SELECT s.referrer_user_id AS user_id, count(*)::int AS joined, count(*) FILTER (WHERE ${countedSql(sql)})::int AS counted
      FROM challenge_signups s JOIN users nu ON nu.id = s.new_user_id JOIN challenges c ON c.id = s.challenge_id
      WHERE s.challenge_id = ${id} GROUP BY s.referrer_user_id
    )
    SELECT u.nickname AS entrant, u.state, p.x_handle, p.tiktok_handle, p.instagram_handle, p.follow_check_status,
           e.id AS entry_id, e.status, e.platform, e.format, e.post_url, ${APP_URL} || '/c/' || e.entry_code AS entry_link,
           e.submitted_at, COALESCE(pe.joined, 0) AS entry_joined, COALESCE(pe.verified, 0) AS entry_verified,
           COALESCE(pe.counted, 0) AS entry_counted, COALESCE(pe.voided, 0) AS entry_voided,
           COALESCE(pp.joined, 0) AS person_joined_all_links, COALESCE(pp.counted, 0) AS person_counted_all_links,
           e.views, e.likes, e.comments, e.shares, e.metrics_verified, e.caption_note
    FROM challenge_entries e
    JOIN users u ON u.id = e.user_id
    JOIN challenge_participants p ON p.challenge_id = e.challenge_id AND p.user_id = e.user_id
    LEFT JOIN per_entry pe ON pe.entry_id = e.id
    LEFT JOIN per_person pp ON pp.user_id = e.user_id
    WHERE e.challenge_id = ${id}
    ORDER BY person_counted_all_links DESC, entry_counted DESC, e.submitted_at
  `;
  return new Response(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${c.slug}-entries.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
