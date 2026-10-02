import type { Metadata } from "next";
import Link from "next/link";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/session";
import { STATES } from "@/lib/states";
import { lagosDate } from "@/lib/util";
import {
  getBudget,
  getEarlyCorperRecipients,
  getMoneySettings,
  getSelectedRecipients,
  getTopReferrerRecipients,
  getUserTotals,
  type Recipients,
} from "@/lib/rewards";
import { formatNgn, KIND_LABEL, parseAmount, REWARD_KINDS, type RewardKind } from "@/lib/reward-meta";
import { awardBatch, savePrizePreset } from "@/app/actions/admin-rewards";
import { btn, btnPrimary, input, panel } from "../../ui";
import { BudgetTracker, Notice } from "../parts";

export const metadata: Metadata = { title: "Award prizes" };

type Mode = "top" | "early" | "selected";
type SP = Record<string, string | string[] | undefined>;

const MODES: Record<Mode, string> = { top: "Top referrers", early: "All Early Corpers", selected: "Selected users" };
const all = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const UUID = /^[0-9a-f-]{36}$/i;

export default async function AwardPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const mode: Mode = one(sp.mode) in MODES ? (one(sp.mode) as Mode) : "top";
  const submitted = one(sp.set) === "1";
  const n = Math.max(1, Math.min(100, Number(one(sp.n)) || 10));
  const state = STATES.includes(one(sp.state) as never) ? one(sp.state) : "";
  // Verified only is on until the admin unticks it (an unticked box isn't sent, hence `set`).
  const verifiedOnly = submitted ? one(sp.verified) === "1" : true;
  const ids = all(sp.ids).filter((id) => UUID.test(id)).slice(0, 500);
  const kind: RewardKind = (REWARD_KINDS as readonly string[]).includes(one(sp.kind)) ? (one(sp.kind) as RewardKind) : "cash";
  const show = one(sp.show) === "1";
  const defaultTitle = mode === "top" ? (state ? `Top referrer in ${state}` : "Top referrer prize") : mode === "early" ? "Early Corper reward" : "Kopamate reward";
  const title = one(sp.title).trim().slice(0, 70) || defaultTitle;
  const review = one(sp.step) === "review";

  const settings = await getMoneySettings();
  const presetKey = state ? "top_state_referrers" : "top_referrers";
  const preset = settings.presets[presetKey] ?? settings.presets.top_referrers ?? [];
  const typed = all(sp.a);
  // One amount per rank: what the admin typed, else the preset; extra rows start empty.
  const rankAmounts = Array.from({ length: n }, (_, i) => (typed.length > 0 ? typed[i] ?? "" : preset[i] ? String(preset[i]) : ""));
  const singleAmount = one(sp.amount);

  // Everything except `step`, to rebuild the setup screen from the review screen.
  const editParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (k !== "step" && k !== "msg") for (const x of all(v)) editParams.append(k, x);

  const tabs = (Object.keys(MODES) as Mode[]).map((m) => {
    const p = new URLSearchParams({ mode: m });
    if (m === "selected") for (const id of ids) p.append("ids", id);
    return { m, href: `/admin/rewards/award?${p}` };
  });

  return (
    <>
      <Link href="/admin/rewards" className="text-sm text-muted hover:text-ink">
        ← Rewards
      </Link>
      <Notice params={{ msg: one(sp.msg) || undefined }} />
      <nav aria-label="Award type" className="flex flex-wrap gap-1.5">
        {tabs.map(({ m, href }) => (
          <Link
            key={m}
            href={href}
            aria-current={m === mode ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-xs font-bold ${m === mode ? "border-lime text-lime-ink" : "border-line text-muted"}`}
          >
            {MODES[m]}
          </Link>
        ))}
      </nav>

      {review ? (
        <Review
          mode={mode}
          n={n}
          state={state}
          verifiedOnly={verifiedOnly}
          ids={ids}
          kind={kind}
          show={show}
          title={title}
          rankAmounts={rankAmounts}
          singleAmount={singleAmount}
          editHref={`/admin/rewards/award?${editParams}`}
        />
      ) : (
        <section className={panel}>
          <h2 className="h-display mb-1 text-lg">{MODES[mode]}</h2>
          <p className="mb-4 text-xs text-muted">
            {mode === "top"
              ? "In leaderboard order (ties go to whoever got there first). Flagged, banned and seed accounts are never on the board."
              : mode === "early"
                ? "Everyone holding the Early Corper badge. Flagged, banned and seed accounts are skipped."
                : "The users you ticked in the Users table. Flagged, banned and seed accounts are skipped."}{" "}
            You&apos;ll see who gets what, and the budget, before anything is saved.
          </p>
          <form className="flex flex-col gap-4">
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="set" value="1" />
            {ids.map((id) => (
              <input key={id} type="hidden" name="ids" value={id} />
            ))}

            {mode === "top" && (
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm text-muted">
                  How many
                  <input name="n" type="number" min={1} max={100} defaultValue={n} className={`${input} w-24`} />
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Where
                  <select name="state" defaultValue={state} className={input}>
                    <option value="">Nationwide</option>
                    {STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <button className={btn}>Update table</button>
              </div>
            )}

            {mode !== "selected" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="verified" value="1" defaultChecked={verifiedOnly} className="size-4 accent-lime" />
                Verified corpers only (recommended: the Rewards page says only verified corpers win)
              </label>
            )}
            {mode === "selected" && ids.length === 0 && (
              <p className="text-sm">
                No users picked yet. Tick them in{" "}
                <Link href="/admin/users" className="underline">
                  Users
                </Link>{" "}
                and choose &quot;Award selected&quot;.
              </p>
            )}
            {mode === "selected" && ids.length > 0 && <p className="text-sm">{ids.length} users picked.</p>}

            {mode === "top" ? (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1 text-sm text-muted">Prize per rank (₦). Empty rows get a hidden reward with no amount.</legend>
                <input type="hidden" name="preset" value={presetKey} />
                <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                  {rankAmounts.map((a, i) => (
                    <label key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-10 text-right font-bold">#{i + 1}</span>
                      <input name="a" defaultValue={a} inputMode="numeric" aria-label={`Amount for rank ${i + 1}`} className={`${input} w-full`} />
                    </label>
                  ))}
                </div>
                <button formAction={savePrizePreset} className={`${btn} self-start`}>
                  Save as preset ({state ? "state awards" : "nationwide"})
                </button>
              </fieldset>
            ) : (
              <label className="flex flex-col gap-1 text-sm text-muted">
                Amount for each person (₦). Leave empty to set it later (rewards start hidden).
                <input name="amount" defaultValue={singleAmount} inputMode="numeric" className={`${input} w-40`} />
              </label>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm text-muted">
                Paid as
                <select name="kind" defaultValue={kind} className={input}>
                  {REWARD_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
                Title (users see this{mode === "top" ? "; the rank is added" : ""})
                <input name="title" defaultValue={title} maxLength={70} className={`${input} min-w-56`} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="show" value="1" defaultChecked={show} className="size-4 accent-lime" />
              Show amount to user (off: they see &quot;Amount revealed soon&quot; until you reveal the batch)
            </label>
            <button name="step" value="review" className={`${btnPrimary} self-start`}>
              Review award
            </button>
          </form>
        </section>
      )}
    </>
  );
}

async function Review(p: {
  mode: Mode;
  n: number;
  state: string;
  verifiedOnly: boolean;
  ids: string[];
  kind: RewardKind;
  show: boolean;
  title: string;
  rankAmounts: string[];
  singleAmount: string;
  editHref: string;
}) {
  const recipients: Recipients =
    p.mode === "top"
      ? await getTopReferrerRecipients(p.n, p.state || null, p.verifiedOnly)
      : p.mode === "early"
        ? await getEarlyCorperRecipients(p.verifiedOnly)
        : await getSelectedRecipients(p.ids);

  const single = parseAmount(p.singleAmount);
  const rows = recipients.list.map((c, i) => ({
    ...c,
    prizeRank: i + 1,
    amount: p.mode === "top" ? parseAmount(p.rankAmounts[i]) : single,
    title: p.mode === "top" ? `${p.title} · #${i + 1}` : p.title,
  }));
  const settings = await getMoneySettings();
  const [budget, totals] = await Promise.all([getBudget(settings), getUserTotals(rows.map((r) => r.id))]);
  const total = rows.reduce((s, r) => s + (r.amount && !Number.isNaN(r.amount) ? r.amount : 0), 0);
  const badAmount = rows.some((r) => Number.isNaN(r.amount));
  const missing = rows.filter((r) => r.amount === null).length;
  const overCap = settings.cap ? rows.filter((r) => (totals.get(r.id) ?? 0) + (r.amount || 0) > settings.cap!).length : 0;
  const problems = [
    rows.length === 0 && "Nobody qualifies, so there's nothing to award.",
    badAmount && "Some amounts aren't valid: whole naira from ₦1 to ₦10,000,000.",
    p.show && missing > 0 && `${missing} ${missing === 1 ? "person has" : "people have"} no amount, so the amounts can't be shown yet. Untick "Show amount" or add amounts.`,
  ].filter(Boolean) as string[];
  const s = recipients.skipped;
  const skippedText = [
    s.flaggedOrBanned && `${s.flaggedOrBanned} flagged or banned`,
    s.seed && `${s.seed} seed ${s.seed === 1 ? "account" : "accounts"}`,
    s.unverified && `${s.unverified} not verified`,
  ].filter(Boolean);
  const batchId = `${p.mode}-${lagosDate()}-${randomBytes(4).toString("hex")}`;

  return (
    <>
      <BudgetTracker b={budget} adding={total} />
      <section className={panel}>
        <h2 className="h-display mb-1 text-lg">Confirm award</h2>
        <p className="mb-3 text-sm">
          <b>{rows.length}</b> {rows.length === 1 ? "person" : "people"} · <b>{formatNgn(total)}</b> in total · {KIND_LABEL[p.kind]} ·{" "}
          {p.show ? "amounts shown right away" : "hidden until you reveal them"}
          {p.mode === "top" && rows.length < p.n && ` · only ${rows.length} of ${p.n} places could be filled`}
        </p>
        <p className="mb-3 text-sm text-muted">
          {skippedText.length > 0 ? `Skipped: ${skippedText.join(", ")}.` : "Nobody was skipped."}
          {p.mode === "top" && s.flaggedOrBanned > 0 && " (Flagged and banned referrers never count on the board.)"}
        </p>
        {overCap > 0 && (
          <p role="alert" className="mb-3 rounded-lg border border-pink px-3 py-2 text-sm">
            {overCap} {overCap === 1 ? "person goes" : "people go"} above the per-user cap of {formatNgn(settings.cap!)} with this award. You can
            still go ahead.
          </p>
        )}
        {problems.map((t) => (
          <p key={t} role="alert" className="mb-3 rounded-lg border border-pink px-3 py-2 text-sm">
            {t}
          </p>
        ))}

        {rows.length > 0 && (
          <div className="mb-4 max-h-[60vh] overflow-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border border-line text-xs text-muted">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">User</th>
                  <th className="p-2">State</th>
                  {p.mode === "top" && <th className="p-2">Friends</th>}
                  <th className="p-2">Amount</th>
                  <th className="p-2">Their total after</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const after = (totals.get(r.id) ?? 0) + (r.amount || 0);
                  const capped = settings.cap !== null && after > settings.cap;
                  return (
                    <tr key={r.id} className="border-t border-line">
                      <td className="p-2">
                        {r.prizeRank}
                        {p.mode === "top" && r.board_rank !== r.prizeRank && <span className="text-xs text-muted"> (board #{r.board_rank})</span>}
                      </td>
                      <td className="p-2">
                        <Link href={`/admin/users/${r.id}`} className="underline">
                          {r.nickname}
                        </Link>
                        {!r.verified && <span className="ml-1 rounded bg-surface-2 px-1 text-xs">Not verified</span>}
                      </td>
                      <td className="p-2">{r.state ?? "–"}</td>
                      {p.mode === "top" && <td className="p-2">{r.refs}</td>}
                      <td className="p-2 font-bold">{r.amount === null ? "No amount" : Number.isNaN(r.amount) ? "Invalid" : formatNgn(r.amount)}</td>
                      <td className={`p-2 ${capped ? "font-bold text-pink-ink" : "text-muted"}`}>
                        {formatNgn(after)}
                        {capped && " · over cap"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {problems.length === 0 && (
            <form action={awardBatch}>
              <input type="hidden" name="batch_id" value={batchId} />
              <input type="hidden" name="kind" value={p.kind} />
              {p.show && <input type="hidden" name="show" value="1" />}
              {rows.map((r) => (
                <span key={r.id} hidden>
                  <input type="hidden" name="user_id" value={r.id} />
                  <input type="hidden" name="amount" value={r.amount ?? ""} />
                  <input type="hidden" name="title" value={r.title} />
                </span>
              ))}
              <button className={btnPrimary}>
                Confirm and award {formatNgn(total)} to {rows.length}
              </button>
            </form>
          )}
          <Link href={p.editHref} className={btn}>
            Back to edit
          </Link>
        </div>
      </section>
    </>
  );
}
