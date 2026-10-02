import type { Budget } from "@/lib/rewards";
import { formatNgn, KIND_LABEL, REWARD_KINDS, STATUS_LABEL, type RewardKind, type RewardStatus } from "@/lib/reward-meta";
import { formatJoined } from "@/lib/util";
import {
  deleteReward,
  markPaid,
  rejectReward,
  reopenReward,
  revealReward,
  startProcessing,
  updateReward,
} from "@/app/actions/admin-rewards";
import { btn, input, panel } from "../ui";

const MESSAGES: Record<string, (p: Record<string, string | undefined>) => string> = {
  awarded: () => "Reward added.",
  batch_awarded: (p) =>
    `Awarded ${p.n ?? 0} ${p.n === "1" ? "reward" : "rewards"}.${p.skipped ? ` Skipped ${p.skipped} (flagged, banned or listed twice).` : ""}`,
  updated: () => "Saved.",
  unchanged: () => "Nothing changed.",
  revealed: () => "Revealed. The user can claim it now.",
  batch_revealed: (p) =>
    `Revealed ${p.n ?? 0}.${p.blocked ? ` ${p.blocked} ${p.blocked === "1" ? "has" : "have"} no amount yet: set one, then reveal.` : ""}`,
  deleted: () => "Reward deleted.",
  processing: () => "Marked as processing. The user's details are now locked.",
  paid: () => "Marked as paid.",
  rejected: () => "Rejected. The user sees your note.",
  reopened: () => "Reopened. The user can claim it again (or it waits for an amount).",
  preset_saved: () => "Preset saved.",
  need_title: () => "Add a title.",
  bad_amount: () => "Amounts must be whole naira, from ₦1 to ₦10,000,000.",
  show_needs_amount: () => "Set an amount before showing it to the user. Nothing was saved.",
  unclaimed_needs_amount: () => "An unclaimed reward must keep an amount. Delete it instead, or keep an amount.",
  locked: () => "That reward has been claimed, so it can't be edited or deleted. Reject it and award a new one instead.",
  no_amount: () => "Set an amount before revealing this reward.",
  not_hidden: () => "That reward isn't hidden any more.",
  stale: () => "That reward changed in the meantime. Nothing was done.",
  need_reference: () => "Add the payment reference to mark it paid.",
  need_note: () => "Add a note for the user to reject it.",
  batch_exists: () => "This award was already saved.",
  bad_batch: () => "That award couldn't be saved. Start again.",
  preset_bad: () => "Every row needs an amount to save the preset.",
};

const ERRORS = new Set([
  "need_title",
  "bad_amount",
  "show_needs_amount",
  "unclaimed_needs_amount",
  "locked",
  "no_amount",
  "not_hidden",
  "stale",
  "need_reference",
  "need_note",
  "bad_batch",
  "preset_bad",
]);

/** The result of the last reward action, plus budget and cap warnings. */
export function Notice({ params }: { params: Record<string, string | undefined> }) {
  const lines: [string, boolean][] = [];
  if (params.msg && MESSAGES[params.msg]) lines.push([MESSAGES[params.msg](params), ERRORS.has(params.msg)]);
  if (params.warn_budget) lines.push(["Heads up: awarded amounts are now over the budget.", true]);
  if (params.warn_cap) {
    lines.push([`Heads up: ${params.warn_cap} ${params.warn_cap === "1" ? "user is" : "users are"} now above the per-user cap.`, true]);
  }
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {lines.map(([text, bad]) => (
        <p key={text} role={bad ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${bad ? "border-pink" : "border-lime"}`}>
          {text}
        </p>
      ))}
    </div>
  );
}

/** Budget, awarded, claimed, processing, paid and remaining, with a bar. `adding` previews an award. */
export function BudgetTracker({ b, adding }: { b: Budget; adding?: number }) {
  const awarded = b.awarded + (adding ?? 0);
  const remaining = b.budget - awarded;
  const pct = (n: number) => (b.budget > 0 ? Math.min(100, (n / b.budget) * 100) : n > 0 ? 100 : 0);
  const cells: [string, number, string?][] = [
    ["Budget", b.budget],
    [adding ? "Awarded after this" : "Awarded", awarded],
    ["Claimed", b.claimed],
    ["Processing", b.processing],
    ["Paid", b.paid],
    [adding ? "Remaining after this" : "Remaining", remaining, remaining < 0 ? "text-pink-ink" : "text-lime-ink"],
  ];
  return (
    <section className={panel} aria-labelledby="budget-title">
      <h2 id="budget-title" className="h-display mb-3 text-lg">
        Budget
      </h2>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {cells.map(([label, value, cls]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className={`h-display text-xl ${cls ?? ""}`}>{value < 0 ? `−${formatNgn(-value)}` : formatNgn(value)}</dd>
          </div>
        ))}
      </dl>
      <div
        className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-label="Budget awarded"
        aria-valuenow={Math.round(pct(awarded))}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`absolute inset-y-0 left-0 ${remaining < 0 ? "bg-pink" : "bg-lime/40"}`} style={{ width: `${pct(awarded)}%` }} />
        <div className="absolute inset-y-0 left-0 bg-lime" style={{ width: `${pct(b.paid)}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        Bright: paid. Faded: awarded but not paid yet (hidden rewards included).
        {adding ? ` This award adds ${formatNgn(adding)}.` : ""}
      </p>
      {adding !== undefined && remaining < 0 && (
        <p role="alert" className="mt-2 rounded-lg border border-pink px-3 py-2 text-sm">
          This award goes {formatNgn(-remaining)} over the budget. You can still go ahead.
        </p>
      )}
      {b.noAmount > 0 && (
        <p className="mt-2 text-sm">
          {b.noAmount} {b.noAmount === 1 ? "reward has" : "rewards have"} no amount yet, so {b.noAmount === 1 ? "it isn't" : "they aren't"} counted
          above.
        </p>
      )}
      {b.legacyPaid > 0 && (
        <p className="mt-1 text-xs text-muted">
          {b.legacyPaid} {b.legacyPaid === 1 ? "reward was" : "rewards were"} paid before amounts were recorded (reference
          &quot;legacy&quot;).
        </p>
      )}
    </section>
  );
}

export type AdminReward = {
  id: string;
  title: string;
  kind: RewardKind;
  status: RewardStatus;
  amount_ngn: number | null;
  admin_note: string | null;
  payment_reference: string | null;
  paid_at: Date | null;
  created_at: Date;
};

const STATUS_STYLE: Record<RewardStatus, string> = {
  hidden: "bg-surface-2",
  unclaimed: "border border-lime",
  claimed: "bg-pink font-bold text-on-accent",
  processing: "bg-pink/30 font-bold",
  paid: "bg-lime font-bold text-on-accent",
  rejected: "bg-ink text-bg",
};

export function StatusPill({ status }: { status: RewardStatus }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

/** Hidden input telling the action which page to come back to. */
const Back = ({ to }: { to: string }) => <input type="hidden" name="back" value={to} />;

/** Every action an admin can take on a reward in its current state. */
export function RewardActions({ r, back }: { r: AdminReward; back: string }) {
  const idField = <input type="hidden" name="id" value={r.id} />;
  const editable = r.status === "hidden" || r.status === "unclaimed";
  return (
    <div className="flex flex-col gap-2">
      {editable && (
        <form action={updateReward} className="flex flex-wrap items-center gap-1.5">
          {idField}
          <Back to={back} />
          <input name="title" defaultValue={r.title} required maxLength={80} aria-label="Title" className={`${input} w-48`} />
          <select name="kind" defaultValue={r.kind} aria-label="Kind" className={input}>
            {REWARD_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <input
            name="amount"
            defaultValue={r.amount_ngn ?? ""}
            inputMode="numeric"
            placeholder="₦ amount"
            aria-label="Amount in naira"
            className={`${input} w-28`}
          />
          <button className={btn}>Save</button>
        </form>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {r.status === "hidden" && (
          <form action={revealReward}>
            {idField}
            <Back to={back} />
            <button className={btn}>
              {r.amount_ngn === null ? "Reveal (needs amount)" : "Reveal amount"}
            </button>
          </form>
        )}
        {editable && (
          <form action={deleteReward}>
            {idField}
            <Back to={back} />
            <button className={btn}>Delete</button>
          </form>
        )}
        {r.status === "claimed" && (
          <form action={startProcessing}>
            {idField}
            <Back to={back} />
            <button className={btn}>Start processing</button>
          </form>
        )}
        {r.status === "processing" && (
          <form action={markPaid} className="flex gap-1.5">
            {idField}
            <Back to={back} />
            <input name="reference" required maxLength={100} placeholder="Payment reference" aria-label="Payment reference" className={`${input} w-40`} />
            <button className={btn}>Mark paid</button>
          </form>
        )}
        {(r.status === "unclaimed" || r.status === "claimed" || r.status === "processing") && (
          <form action={rejectReward} className="flex gap-1.5">
            {idField}
            <Back to={back} />
            <input name="note" required maxLength={200} placeholder="Note for the user" aria-label="Reason shown to the user" className={`${input} w-44`} />
            <button className={btn}>Reject</button>
          </form>
        )}
        {r.status === "rejected" && (
          <>
            <span className="text-xs text-muted">Note: {r.admin_note}</span>
            <form action={reopenReward}>
              {idField}
              <Back to={back} />
              <button className={btn}>Reopen</button>
            </form>
          </>
        )}
        {r.status === "paid" && (
          <span className="text-xs text-muted">
            Paid {r.paid_at ? formatJoined(r.paid_at) : ""} · ref {r.payment_reference}
          </span>
        )}
      </div>
    </div>
  );
}

/** One-line summary: "₦30,000 cash" or "No amount · airtime". */
export function amountLabel(r: { amount_ngn: number | null; kind: RewardKind }) {
  return r.amount_ngn ? `${formatNgn(r.amount_ngn)} ${r.kind}` : `No amount · ${r.kind}`;
}
