import type { Metadata } from "next";
import Link from "next/link";
import { checkMetrics, reviewEntries } from "@/app/actions/admin-challenges";
import { ENTRY_SORTS, getAdminEntries, type EntrySort } from "@/lib/challenges-admin";
import { FORMAT_LABEL, PLATFORM_LABEL, type Format } from "@/lib/challenge-rules";
import type { EntryStatus } from "@/lib/challenges";
import { formatNumber, timeAgo } from "@/lib/util";
import { btn, btnPrimary, input, panel } from "../../../ui";
import { challengeOr404, Notice } from "../../parts";

export const metadata: Metadata = { title: "Entries" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; status?: string; sort?: string }> };

const FILTERS: (EntryStatus | "all")[] = ["pending", "approved", "rejected", "disqualified", "all"];
const SORT_LABEL: Record<EntrySort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  counted: "Most counted sign-ups",
  joined: "Most joined",
  views: "Most views",
};

export default async function ChallengeEntriesPage({ params, searchParams }: Props) {
  const c = await challengeOr404(params);
  const sp = await searchParams;
  const status = (FILTERS as string[]).includes(sp.status ?? "") ? (sp.status as EntryStatus | "all") : "pending";
  const sort = (sp.sort ?? "") in ENTRY_SORTS ? (sp.sort as EntrySort) : status === "pending" ? "oldest" : "counted";
  const entries = await getAdminEntries(c.id, status, sort);
  const base = `/admin/challenges/${c.id}/entries`;

  return (
    <>
      <Notice msg={sp.msg} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1.5" aria-label="Filter entries">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={`${base}?status=${f}`}
              className={`rounded-full px-3 py-1.5 text-sm font-bold capitalize ${status === f ? "bg-lime text-on-accent" : "border border-line text-muted"}`}
            >
              {f}
            </Link>
          ))}
        </nav>
        <form className="flex items-center gap-2 text-sm">
          <input type="hidden" name="status" value={status} />
          <select name="sort" defaultValue={sort} className={input}>
            {(Object.keys(SORT_LABEL) as EntrySort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>
          <button className={btn}>Sort</button>
        </form>
      </div>

      {entries.length > 0 && status === "pending" && (
        <form id="bulk" action={reviewEntries} className={`${panel} flex flex-wrap items-center gap-3`}>
          <input type="hidden" name="challenge_id" value={c.id} />
          <input type="hidden" name="decision" value="approved" />
          <span className="text-sm text-muted">Tick entries below, then:</span>
          <button className={btnPrimary}>Approve ticked</button>
        </form>
      )}

      {entries.length === 0 ? (
        <p className={`${panel} text-sm text-muted`}>No {status === "all" ? "" : status} entries.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((e) => (
            <li key={e.id} className={`${panel} flex flex-col gap-3 text-sm`}>
              <div className="flex flex-wrap items-start gap-3">
                {status === "pending" && (
                  <input type="checkbox" name="entry_id" value={e.id} form="bulk" aria-label={`Select ${e.nickname}'s entry`} className="mt-1 size-4 accent-lime" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    <Link href={`/admin/users/${e.user_id}`} className="underline">
                      {e.nickname}
                    </Link>{" "}
                    <span className="font-normal text-muted">
                      · {e.state ?? "–"} · {PLATFORM_LABEL[e.platform]} @{e.handle ?? "?"} · {FORMAT_LABEL[e.format as Format]} · {timeAgo(e.submitted_at)}
                    </span>
                  </p>
                  <a href={e.post_url} target="_blank" rel="noopener noreferrer" className="break-all text-lime-ink underline">
                    {e.post_url}
                  </a>
                  {e.caption_note && <p className="mt-1 text-muted">Note: {e.caption_note}</p>}
                  <p className="mt-1 text-muted">
                    Link /c/{e.entry_code} ·{" "}
                    <Link href={`/admin/challenges/${c.id}/signups?referrer=${e.user_id}`} className="underline">
                      {e.joined} joined · {e.verified} verified · <b className="text-ink">{e.counted} counted</b>
                      {e.voided ? ` · ${e.voided} voided` : ""}
                    </Link>{" "}
                    · Follow check: {e.follow_check_status}
                  </p>
                  {e.status === "rejected" && e.reject_reason && <p className="mt-1 text-pink-ink">Rejected: {e.reject_reason}</p>}
                </div>
                <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-bold capitalize">{e.status}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {e.status !== "approved" && (
                  <form action={reviewEntries}>
                    <input type="hidden" name="challenge_id" value={c.id} />
                    <input type="hidden" name="entry_id" value={e.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <button className={btnPrimary}>Approve</button>
                  </form>
                )}
                {e.status !== "rejected" && (
                  <form action={reviewEntries} className="flex gap-2">
                    <input type="hidden" name="challenge_id" value={c.id} />
                    <input type="hidden" name="entry_id" value={e.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <input name="reason" required maxLength={300} placeholder="Reason the entrant sees" className={`${input} w-64`} />
                    <button className={btn}>Reject</button>
                  </form>
                )}
                {e.status === "approved" && (
                  <form action={reviewEntries}>
                    <input type="hidden" name="challenge_id" value={c.id} />
                    <input type="hidden" name="entry_id" value={e.id} />
                    <input type="hidden" name="decision" value="disqualified" />
                    <button className={btn}>Disqualify</button>
                  </form>
                )}
              </div>

              {e.metrics_submitted_at && (
                <form action={checkMetrics} className="flex flex-wrap items-end gap-2 rounded-xl bg-surface-2 p-3">
                  <input type="hidden" name="challenge_id" value={c.id} />
                  <input type="hidden" name="entry_id" value={e.id} />
                  {e.has_shot && (
                    <a href={`/admin/challenges/screenshot/${e.id}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/admin/challenges/screenshot/${e.id}`} alt="Stats screenshot" className="h-28 rounded-lg border border-line" />
                    </a>
                  )}
                  {(["views", "likes", "comments", "shares"] as const).map((k) => (
                    <label key={k} className="flex flex-col gap-1 text-xs capitalize text-muted">
                      {k}
                      <input name={k} defaultValue={e[k] ?? ""} inputMode="numeric" className={`${input} w-24`} />
                    </label>
                  ))}
                  <span className="text-xs text-muted">
                    {e.metrics_verified ? "✓ Checked" : "Not checked"} · sent {timeAgo(e.metrics_submitted_at)}
                    {e.views ? ` · ${formatNumber(e.views)} views` : ""}
                  </span>
                  <button name="verified" value="1" className={btnPrimary}>
                    Save as checked
                  </button>
                  <button name="verified" value="0" className={btn}>
                    Not right
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
