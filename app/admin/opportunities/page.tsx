import type { Metadata } from "next";
import { addOpportunity, refreshOpportunities, setOpportunityFlag } from "@/app/actions/admin-content";
import { sql } from "@/lib/db";
import { CATEGORIES, CATEGORY_LABEL, type Opportunity } from "@/lib/opportunities";
import { requireAdmin } from "@/lib/session";
import { timeAgo } from "@/lib/util";
import { btn, btnPrimary, input, panel } from "../ui";

export const metadata: Metadata = { title: "Opportunities" };

type Row = Opportunity & { hidden: boolean; added_by: string | null };

type Props = { searchParams: Promise<{ added?: string; failed?: string; msg?: string; show?: string }> };

function Flag({ id, flag, on, label }: { id: string; flag: "hidden" | "pinned"; on: boolean; label: string }) {
  return (
    <form action={setOpportunityFlag}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="flag" value={flag} />
      <input type="hidden" name="on" value={on ? "1" : "0"} />
      <button className={btn}>{label}</button>
    </form>
  );
}

export default async function AdminOpportunitiesPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const showHidden = sp.show === "hidden";
  const [rows, [counts]] = await Promise.all([
    sql<Row[]>`
      SELECT id::text, url, title, summary, source, category, deadline, published_at, pinned, hidden, added_by
      FROM opportunities WHERE hidden = ${showHidden}
      ORDER BY pinned DESC, published_at DESC LIMIT 150
    `,
    sql<{ live: number; hidden: number; week: number }[]>`
      SELECT count(*) FILTER (WHERE NOT hidden)::int AS live, count(*) FILTER (WHERE hidden)::int AS hidden,
             count(*) FILTER (WHERE NOT hidden AND created_at > now() - interval '7 days')::int AS week
      FROM opportunities
    `,
  ]);

  return (
    <>
      {sp.added !== undefined && (
        <p role="status" className="rounded-2xl border border-lime p-4 text-sm">
          Fetched: {sp.added} new.{sp.failed && ` These feeds failed: ${sp.failed}.`}
        </p>
      )}
      {sp.msg === "added" && <p role="status" className="rounded-2xl border border-lime p-4 text-sm">Opportunity added.</p>}
      {sp.msg === "invalid" && (
        <p role="alert" className="rounded-2xl border border-pink p-4 text-sm">
          Needs a title, an https:// link and a category. Nothing was added.
        </p>
      )}

      <section className={panel}>
        <h2 className="h-display mb-1 text-lg">Opportunities</h2>
        <p className="mb-3 text-sm text-muted">
          {counts.live} live · {counts.week} new this week · {counts.hidden} hidden. Fetched every morning at 6:00 from Opportunities For
          Africans, Opportunity Desk, Opportunities for Youth and Hot Nigerian Jobs (entry-level jobs only). Items older than 60 days are
          removed unless pinned or added here.
        </p>
        <form action={refreshOpportunities}>
          <button className={btnPrimary}>Fetch now</button>
        </form>
      </section>

      <section className={panel}>
        <h2 className="h-display mb-3 text-lg">Add one</h2>
        <form action={addOpportunity} className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-muted md:col-span-2">
            Title
            <input name="title" required maxLength={200} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Link (https://)
            <input name="url" required type="url" pattern="https://.+" maxLength={500} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Category
            <select name="category" required className={input}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Source (optional)
            <input name="source" maxLength={60} placeholder="Kopamate" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Deadline (optional)
            <input name="deadline" maxLength={40} placeholder="31 October 2026" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted md:col-span-2">
            Short description (optional)
            <textarea name="summary" rows={2} maxLength={300} className="rounded-lg border border-line bg-bg p-3 text-sm text-ink" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="pinned" value="1" defaultChecked className="size-4 accent-lime" />
            Featured (shown first)
          </label>
          <button type="submit" className={`${btnPrimary} justify-self-start`}>
            Add
          </button>
        </form>
      </section>

      <section className={panel}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="h-display text-lg">{showHidden ? "Hidden" : "Live"}</h2>
          <a href={showHidden ? "/admin/opportunities" : "/admin/opportunities?show=hidden"} className={btn}>
            {showHidden ? "Show live" : "Show hidden"}
          </a>
        </div>
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((o) => (
            <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <a href={o.url} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">
                  {o.pinned && <span className="mr-1.5 rounded bg-lime px-1.5 py-0.5 text-[11px] text-on-accent">Featured</span>}
                  {o.title}
                </a>
                <p className="text-xs text-faint">
                  {CATEGORY_LABEL[o.category]} · {o.source} · {timeAgo(o.published_at)}
                  {o.deadline && ` · closes ${o.deadline}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Flag id={o.id} flag="pinned" on={!o.pinned} label={o.pinned ? "Unfeature" : "Feature"} />
                <Flag id={o.id} flag="hidden" on={!o.hidden} label={o.hidden ? "Unhide" : "Hide"} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
