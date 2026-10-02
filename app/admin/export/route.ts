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
    // Prevent spreadsheet formula injection from nicknames, account names and other typed text.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

/** Prize lists for the admin. Only verified users; flagged, banned and seed accounts are left out. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return new Response("Not found", { status: 404 });
  const list = new URL(req.url).searchParams.get("list");

  let rows: Record<string, unknown>[];
  let name: string;
  if (list === "payouts") {
    // Claimed and processing rewards with payout details, for paying them. Admin only, never cached.
    name = "payouts";
    rows = await sql`
      SELECT u.nickname, u.whatsapp_e164 AS whatsapp, r.kind, r.amount_ngn AS amount, r.status,
             r.payout_bank AS bank, r.payout_account_number AS account_number, r.payout_account_name AS account_name,
             r.payout_phone AS phone, r.id AS reward_id
      FROM rewards r JOIN users u ON u.id = r.user_id
      WHERE r.status IN ('claimed', 'processing')
      ORDER BY r.status DESC, r.claimed_at
    `;
  } else if (list === "early") {
    // Early Corpers holding the badge (not revoked); flagged, banned and seed accounts left out.
    name = "early-corpers";
    rows = await sql`
      SELECT u.nickname, u.whatsapp_e164 AS whatsapp, u.state, ub.awarded_at
      FROM user_badges ub JOIN users u ON u.id = ub.user_id
      WHERE ub.badge_slug = 'early_corper' AND ub.revoked_at IS NULL
        AND NOT u.is_flagged AND NOT u.is_banned AND NOT u.is_seed
      ORDER BY u.signup_number
    `;
  } else if (list === "referrers") {
    name = "top-referrers";
    rows = await sql`
      ${ranked()}
      SELECT (row_number() OVER (ORDER BY r.refs DESC, r.reached_at ASC))::int AS rank,
             u.nickname, u.whatsapp_e164 AS whatsapp, u.email, u.state, u.state_code, r.refs AS referrals
      FROM ranked r JOIN users u ON u.id = r.id
      WHERE r.refs > 0 AND r.verified
      ORDER BY rank LIMIT ${TOP_REFERRERS}
    `;
  } else {
    name = "first-500";
    const mode = await getFirstNMode();
    rows = await sql`
      ${ranked()}
      SELECT ${mode === "signup" ? sql`r.prize_signup` : sql`r.prize_position`} AS rank,
             u.nickname, u.whatsapp_e164 AS whatsapp, u.email, u.state, u.state_code, r.position, r.signup_number, r.refs AS referrals
      FROM ranked r JOIN users u ON u.id = r.id
      WHERE r.verified
      ORDER BY ${mode === "signup" ? sql`r.prize_signup` : sql`r.prize_position`}
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
