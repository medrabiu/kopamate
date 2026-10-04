import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { ranked } from "@/lib/ranking";
import { timeAgo } from "@/lib/util";
import { normalizeNigerianPhone } from "@/lib/validate";
import { input, PAGE_SIZE } from "../ui";
import { StatusBadges } from "../badges";
import BadgeIcon from "@/components/BadgeIcon";
import { formatBatch, STAGE_CHIP, type Stage } from "@/lib/nysc";

export const metadata: Metadata = { title: "Users" };

const FILTERS = {
  all: "All",
  real: "Real",
  seed: "Seed",
  pending: "Pending check",
  verified: "Verified",
  flagged: "Flagged",
  banned: "Banned",
  unfinished: "Unfinished",
} as const;
type Filter = keyof typeof FILTERS;

type Row = {
  id: string;
  nickname: string;
  whatsapp_e164: string | null;
  email: string | null;
  state: string | null;
  nysc_stage: Stage;
  nysc_batch: string | null;
  completed_at: Date | null;
  created_at: Date;
  position: number | null;
  refs: number | null;
  is_flagged: boolean;
  is_banned: boolean;
  is_seed: boolean;
  verification_status: string;
  badges: { slug: string; name: string; icon: string; color: string; revoked: boolean }[];
};

function filterSql(f: Filter) {
  switch (f) {
    case "real":
      return sql`NOT u.is_seed`;
    case "seed":
      return sql`u.is_seed`;
    case "pending":
      return sql`u.verification_status = 'pending'`;
    case "verified":
      return sql`u.verification_status = 'verified'`;
    case "flagged":
      return sql`u.is_flagged`;
    case "banned":
      return sql`u.is_banned`;
    case "unfinished":
      return sql`u.completed_at IS NULL`;
    default:
      return sql`true`;
  }
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const search = (sp.q ?? "").trim().slice(0, 80);
  const filter: Filter = sp.f && sp.f in FILTERS ? (sp.f as Filter) : "real";
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));
  const phone = normalizeNigerianPhone(search);
  const like = `%${search.replace(/[%_\\]/g, "\\$&")}%`;

  // One extra row tells us whether there's a next page, without a separate count query.
  const rows = await sql<Row[]>`
    ${ranked()}
    SELECT u.id, u.nickname, u.whatsapp_e164, u.email, u.state, u.nysc_stage, u.nysc_batch, u.completed_at, u.created_at,
           r.position, r.refs, u.is_flagged, u.is_banned, u.is_seed, u.verification_status,
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object('slug', b.slug, 'name', b.name, 'icon', b.icon, 'color', b.color,
                                                 'revoked', ub.revoked_at IS NOT NULL) ORDER BY b.priority DESC)
             FROM user_badges ub JOIN badges b ON b.slug = ub.badge_slug WHERE ub.user_id = u.id
           ), '[]'::jsonb) AS badges
    FROM users u LEFT JOIN ranked r ON r.id = u.id
    WHERE ${filterSql(filter)}
      AND ${
        search
          ? sql`(u.nickname ILIKE ${like} OR u.full_name ILIKE ${like} OR u.email ILIKE ${like} OR u.referral_code = ${search.toLowerCase()}
                 OR u.whatsapp_e164 = ${phone ?? "-"} OR u.state_code = ${search.toUpperCase()})`
          : sql`true`
      }
    ORDER BY u.created_at DESC
    LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}
  `;
  const hasNext = rows.length > PAGE_SIZE;
  const users = rows.slice(0, PAGE_SIZE);
  const href = (p: Partial<{ q: string; f: string; page: number }>) => {
    const params = new URLSearchParams();
    const q = p.q ?? search;
    const f = p.f ?? filter;
    if (q) params.set("q", q);
    if (f !== "real") params.set("f", f);
    if ((p.page ?? 1) > 1) params.set("page", String(p.page));
    const s = params.toString();
    return `/admin/users${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <form className="flex gap-2">
        {filter !== "real" && <input type="hidden" name="f" value={filter} />}
        <input
          name="q"
          defaultValue={search}
          placeholder="Search username, full name, phone, email, state code or referral code"
          className={`${input} flex-1`}
        />
        <button className="rounded-lg bg-lime px-4 text-sm font-bold text-on-accent">Search</button>
      </form>

      <nav aria-label="Filter users" className="flex flex-wrap gap-1.5">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <Link
            key={f}
            href={href({ f, page: 1 })}
            aria-current={f === filter ? "true" : undefined}
            className={`rounded-full border px-3 py-1 text-xs font-bold ${f === filter ? "border-lime text-lime-ink" : "border-line text-muted"}`}
          >
            {FILTERS[f]}
          </Link>
        ))}
      </nav>

      <form action="/admin/rewards/award" className="flex flex-col gap-2">
      <input type="hidden" name="mode" value="selected" />
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted">Tick users to give them all the same reward.</span>
        <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold hover:bg-surface-2">Award selected</button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-line">
              <th className="w-8 p-3">
                <span className="sr-only">Select</span>
              </th>
              <th className="p-3">User</th>
              <th className="p-3">Contact</th>
              <th className="p-3">State</th>
              <th className="p-3">Pos.</th>
              <th className="p-3">Refs</th>
              <th className="p-3">Badges</th>
              <th className="p-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line align-top hover:bg-surface-2/50">
                <td className="p-3">
                  <input type="checkbox" name="ids" value={u.id} aria-label={`Select ${u.nickname}`} className="size-4 accent-lime" />
                </td>
                <td className="p-3">
                  <Link href={`/admin/users/${u.id}`} className="font-bold underline-offset-2 hover:underline">
                    {u.nickname}
                  </Link>
                  <StatusBadges user={u} />
                </td>
                <td className="p-3 text-muted">
                  <div>{u.whatsapp_e164 ?? "–"}</div>
                  <div className="text-xs">{u.email}</div>
                </td>
                <td className="p-3">
                  <div>{u.state ?? "–"}</div>
                  <div className="text-xs text-muted">{STAGE_CHIP[u.nysc_stage]}{u.nysc_batch ? ` · ${formatBatch(u.nysc_batch, true)}` : ""}</div>
                </td>
                <td className="p-3">{u.position ?? "–"}</td>
                <td className="p-3">{u.refs ?? 0}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {u.badges.map((b) => (
                      <span key={b.slug} title={b.revoked ? `${b.name} (revoked)` : b.name} className={b.revoked ? "opacity-30" : ""}>
                        <BadgeIcon badge={b} size={18} />
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-3 text-muted">{timeAgo(u.completed_at ?? u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="p-5 text-sm text-muted">No users found.</p>}
      </div>
      </form>

      {(page > 1 || hasNext) && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={href({ page: page - 1 })} className="font-bold text-lime-ink">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">Page {page}</span>
          {hasNext ? (
            <Link href={href({ page: page + 1 })} className="font-bold text-lime-ink">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
