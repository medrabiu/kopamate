import { getCurrentUser, isAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { ranked } from "@/lib/ranking";
import { FIRST_N, TOP_REFERRERS } from "@/lib/config";
import { getFirstNMode } from "@/lib/stats";
import { lagosDate } from "@/lib/util";

export const dynamic = "force-dynamic";

function csv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // Prevent spreadsheet formula injection from nicknames.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

/** Prize lists for the admin. Flagged and banned users are left out. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return new Response("Not found", { status: 404 });
  const list = new URL(req.url).searchParams.get("list");

  let rows: Record<string, unknown>[];
  let name: string;
  if (list === "referrers") {
    name = "top-referrers";
    rows = await sql`
      ${ranked()}
      SELECT (row_number() OVER (ORDER BY r.refs DESC, r.reached_at ASC))::int AS rank,
             u.nickname, u.whatsapp_e164 AS whatsapp, u.email, u.state, r.refs AS referrals
      FROM ranked r JOIN users u ON u.id = r.id
      WHERE r.refs > 0 AND NOT u.is_flagged
      ORDER BY rank LIMIT ${TOP_REFERRERS}
    `;
  } else {
    name = "first-500";
    const mode = await getFirstNMode();
    rows = await sql`
      ${ranked()}
      SELECT ${mode === "signup" ? sql`r.signup_number` : sql`r.position`} AS rank,
             u.nickname, u.whatsapp_e164 AS whatsapp, u.email, u.state, r.position, r.signup_number, r.refs AS referrals
      FROM ranked r JOIN users u ON u.id = r.id
      WHERE NOT u.is_flagged
      ORDER BY ${mode === "signup" ? sql`r.signup_number` : sql`r.position`}
      LIMIT ${FIRST_N}
    `;
  }

  return new Response(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kopamate-${name}-${lagosDate()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
