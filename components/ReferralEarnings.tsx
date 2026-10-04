"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import Sheet from "./Sheet";
import { ChevronRight, GiftIcon } from "./icons";
import { withdrawBonus, type WithdrawState } from "@/app/actions/referral-bonus";
import { formatNgn } from "@/lib/reward-meta";

type Props = {
  enabled: boolean;
  rate: number;
  minWithdraw: number;
  available: number;
  withdrawn: number;
  earnedCount: number;
  verified: boolean;
  underReview: boolean;
  /** Compact summary linking to Invite (Rewards page) instead of the full card. */
  compact?: boolean;
  /** Compact only: replaces the bordered row's classes (the Rewards wallet card shows it as a plain line). */
  className?: string;
};

const KINDS = [
  { value: "cash", label: "Bank transfer" },
  { value: "airtime", label: "Airtime" },
  { value: "data", label: "Data" },
] as const;

/** "₦250 for every friend who gets verified": balance, what's been withdrawn, and the Withdraw sheet. */
export default function ReferralEarnings(p: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>("cash");
  // The balance drops to 0 once the page refreshes, so remember what was withdrawn for the message.
  const [sent, setSent] = useState(0);
  const [state, action, pending] = useActionState<WithdrawState, FormData>(withdrawBonus, undefined);
  const short = Math.max(0, p.minWithdraw - p.available);
  const canWithdraw = p.verified && !p.underReview && p.available > 0 && short === 0;

  const on = p.enabled && p.rate > 0;
  // Off, and nothing earned before it was switched off: nothing to show.
  if (!on && p.earnedCount === 0) return null;

  const headline = on ? `Earn ${formatNgn(p.rate)} for every friend who gets verified` : "Referral earnings";

  if (p.compact) {
    return (
      <Link href="/invite#earnings" className={p.className ?? "flex items-center gap-3.5 rounded-[20px] border border-line px-4 py-3.5"}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-lime-ink">
          <GiftIcon size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">
            {formatNgn(p.available)} <span className="font-normal text-muted">referral earnings</span>
          </span>
          <span className="block text-sm leading-snug text-muted">{headline}</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-faint" />
      </Link>
    );
  }

  return (
    <section id="earnings" className="card flex scroll-mt-5 flex-col gap-4 !p-[22px]" aria-labelledby="earnings-title">
      <div className="flex flex-col gap-1">
        <h2 id="earnings-title" className="text-sm font-bold text-lime-ink">
          {headline}
        </h2>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="h-display text-[40px] leading-none">{formatNgn(p.available)}</div>
            <div className="mt-1 text-sm text-muted">available to withdraw</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={!canWithdraw}
            className="h-11 shrink-0 rounded-full bg-lime px-5 text-[15px] font-bold text-on-accent disabled:bg-surface-2 disabled:text-faint"
          >
            Withdraw
          </button>
        </div>
      </div>

      {short > 0 && p.available >= 0 && (
        <div className="flex flex-col gap-2">
          <div
            className="h-2 rounded-full bg-surface-2"
            role="progressbar"
            aria-label="Progress to the least you can withdraw"
            aria-valuenow={Math.round((p.available / p.minWithdraw) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-2 rounded-full bg-lime" style={{ width: `${Math.max(4, (p.available / p.minWithdraw) * 100)}%` }} />
          </div>
          <p className="text-sm">
            {formatNgn(short)} more to withdraw
            {on && <span className="text-muted"> · {Math.ceil(short / p.rate)} more verified {Math.ceil(short / p.rate) === 1 ? "friend" : "friends"}</span>}
          </p>
        </div>
      )}

      <dl className="grid grid-cols-2 divide-x divide-line rounded-2xl border border-line py-3 text-center">
        <div className="flex flex-col-reverse">
          <dt className="text-xs text-muted">Verified friends</dt>
          <dd className="h-display text-lg">{p.earnedCount}</dd>
        </div>
        <div className="flex flex-col-reverse">
          <dt className="text-xs text-muted">Withdrawn</dt>
          <dd className="h-display text-lg">{formatNgn(p.withdrawn)}</dd>
        </div>
      </dl>

      {!p.verified ? (
        <Link href="/profile#verify" className="text-sm font-bold text-lime-ink">
          Get verified to withdraw your earnings ›
        </Link>
      ) : p.underReview ? (
        <p className="text-sm text-muted">Your account is under review, so earnings can&apos;t be withdrawn right now.</p>
      ) : (
        <p className="text-sm text-muted">Friends count once they get verified in their Profile. Paid as a bank transfer, airtime or data.</p>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={state?.ok ? "Withdrawn" : `Withdraw ${formatNgn(p.available)}`}>
        {state?.ok ? (
          <div className="flex flex-col gap-3">
            <p className="text-[15px] leading-normal">
              Done. Your {formatNgn(sent)} is waiting on Rewards: add your details there to get paid.
            </p>
            <Link href="/rewards#your-rewards" className="btn-primary h-12 text-[15px]">
              Claim it on Rewards
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setSent(p.available);
              startTransition(() => action(fd));
            }}
            className="flex flex-col gap-3"
          >
            <fieldset className="flex flex-col gap-2">
              <legend className="label mb-2">How do you want it?</legend>
              {KINDS.map((k) => (
                <label
                  key={k.value}
                  className={`flex h-12 cursor-pointer items-center gap-3 rounded-[14px] border px-4 ${kind === k.value ? "border-lime" : "border-line"}`}
                >
                  <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="accent-lime" />
                  <span className="font-medium">{k.label}</span>
                </label>
              ))}
            </fieldset>
            {state?.error && (
              <p role="alert" className="text-sm text-pink-ink">
                {state.error}
              </p>
            )}
            <button type="submit" disabled={pending} className="btn-primary h-12 text-[15px]">
              {pending ? "Withdrawing…" : `Withdraw ${formatNgn(p.available)}`}
            </button>
            <p className="text-xs text-muted">You&apos;ll add your bank or phone number on Rewards next. Payments go out within 72 hours.</p>
          </form>
        )}
      </Sheet>
    </section>
  );
}
