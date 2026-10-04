"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import Sheet from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { ChevronDown, GiftIcon } from "@/components/icons";
import { claimReward, type ClaimState } from "@/app/actions/rewards";
import { BANKS, formatNgn, maskAccount, type RewardKind, type RewardStatus } from "@/lib/reward-meta";

export type MyReward = {
  id: string;
  title: string;
  description: string | null;
  kind: RewardKind;
  status: RewardStatus;
  amount_ngn: number | null;
  admin_note: string | null;
  paid_at: string | null;
  created_at: string;
  payout_bank: string | null;
  payout_account_number: string | null;
  payout_account_name: string | null;
  payout_phone: string | null;
};

/** Bank details from the user's last cash claim, used to prefill the next one. */
export type SavedBank = { bank: string | null; account_number: string | null; account_name: string | null };

const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));
const won = (r: MyReward) => `You won ${formatNgn(r.amount_ngn ?? 0)}${r.kind === "cash" ? "" : ` ${r.kind}`}`;

function headline(r: MyReward) {
  switch (r.status) {
    case "hidden":
      return "🎁 You won a reward! Amount revealed soon";
    case "paid":
      return r.amount_ngn ? `${formatNgn(r.amount_ngn)}${r.kind === "cash" ? "" : ` ${r.kind}`}` : r.title;
    case "rejected":
      return r.amount_ngn ? won(r) : "Reward";
    default:
      return won(r);
  }
}

function payoutSummary(r: MyReward) {
  if (r.payout_phone) return `To ${r.payout_phone.replace("+234", "0")}`;
  if (r.payout_account_number) return `To ${maskAccount(r.payout_bank, r.payout_account_number)} · ${r.payout_account_name}`;
  return null;
}

export default function YourRewards({
  rewards,
  savedBank,
  whatsapp,
  underReview,
}: {
  rewards: MyReward[];
  savedBank: SavedBank;
  whatsapp: string | null;
  underReview: boolean;
}) {
  const [open, setOpen] = useState<MyReward | null>(null);
  const [toast, show] = useToast();

  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {rewards.map((r) => {
          const summary = payoutSummary(r);
          return (
            <li key={r.id} className={`flex flex-col gap-3 rounded-[18px] p-4 ${r.status === "unclaimed" ? "border-[1.5px] border-lime" : "border border-line"}`}>
              <div className="flex items-start gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-pink-ink">
                  <GiftIcon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`font-bold ${r.status === "unclaimed" ? "h-display text-lg text-lime-ink" : ""}`}>{headline(r)}</div>
                  <div className="text-sm text-muted">{r.title}</div>
                  {r.description && <div className="text-sm text-muted">{r.description}</div>}
                  {r.status === "claimed" && (
                    <div className="mt-1 text-sm">
                      Claimed · payments go out within 72 hours
                      {summary && <span className="block text-muted">{summary}</span>}
                    </div>
                  )}
                  {r.status === "processing" && (
                    <div className="mt-1 text-sm font-medium text-pink-ink">
                      Payment in progress
                      {summary && <span className="block font-normal text-muted">{summary}</span>}
                    </div>
                  )}
                  {r.status === "paid" && <div className="mt-1 text-sm font-bold text-lime-ink">Paid ✓ {r.paid_at ? day(r.paid_at) : ""}</div>}
                  {r.status === "rejected" && (
                    <div className="mt-1 text-sm">
                      <span className="font-bold text-pink-ink">Not approved.</span> {r.admin_note}
                    </div>
                  )}
                  <div className="mt-0.5 text-xs text-faint">Won {day(r.created_at)}</div>
                </div>
              </div>
              {(r.status === "unclaimed" || r.status === "claimed") &&
                (underReview ? (
                  <p className="rounded-full bg-surface-2 px-4 py-2.5 text-center text-sm font-bold text-muted">Under review</p>
                ) : r.status === "unclaimed" ? (
                  <button type="button" onClick={() => setOpen(r)} className="btn-primary h-12 text-[15px]">
                    Claim {formatNgn(r.amount_ngn ?? 0)}
                  </button>
                ) : (
                  <button type="button" onClick={() => setOpen(r)} className="btn-secondary h-11 text-[15px]">
                    Edit details
                  </button>
                ))}
            </li>
          );
        })}
      </ul>
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.status === "claimed" ? "Edit your details" : open ? `Claim ${formatNgn(open.amount_ngn ?? 0)}` : "Claim"}>
        {open && (
          <ClaimForm
            key={open.id}
            reward={open}
            savedBank={savedBank}
            whatsapp={whatsapp}
            onDone={() => {
              show(open.status === "claimed" ? "Details updated" : "Claimed! Payments go out within 72 hours");
              setOpen(null);
            }}
          />
        )}
      </Sheet>
      {toast}
    </>
  );
}

/** Shown before "See all" in History. */
const HISTORY_PREVIEW = 3;

function historyStatus(r: MyReward): { text: string; tone: "lime" | "pink" | "muted" } {
  if (r.status === "paid") return { text: `Paid${r.paid_at ? ` · ${day(r.paid_at)}` : ""}`, tone: "lime" };
  if (r.status === "processing") return { text: "On the way", tone: "pink" };
  if (r.status === "rejected") return { text: `Not approved${r.admin_note ? ` · ${r.admin_note}` : ""}`, tone: "pink" };
  return { text: `Won ${day(r.created_at)}`, tone: "muted" };
}

const amountOf = (r: MyReward) => (r.amount_ngn ? `${formatNgn(r.amount_ngn)}${r.kind === "cash" ? "" : ` ${r.kind}`}` : "–");

/**
 * Past rewards (paid, on the way, not approved) as a compact list, like a bank app's transactions:
 * one line each with the amount on the right. Tapping one shows everything about it.
 */
export function RewardHistory({ rewards }: { rewards: MyReward[] }) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<MyReward | null>(null);
  const shown = all ? rewards : rewards.slice(0, HISTORY_PREVIEW);
  const tone = { lime: "text-lime-ink", pink: "text-pink-ink", muted: "text-faint" };
  return (
    <>
      <ul className="card flex flex-col divide-y divide-line !p-0">
        {shown.map((r) => {
          const st = historyStatus(r);
          return (
            <li key={r.id}>
              <button type="button" onClick={() => setOpen(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-pink-ink">
                  <GiftIcon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{r.title}</span>
                  <span className={`block truncate text-[13px] ${tone[st.tone]}`}>{st.text}</span>
                </span>
                <span className={`shrink-0 text-[15px] font-bold tabular-nums ${r.status === "rejected" ? "text-faint line-through" : ""}`}>
                  {amountOf(r)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {rewards.length > HISTORY_PREVIEW && (
        <button type="button" onClick={() => setAll((v) => !v)} className="-mt-2 self-center py-2 text-sm font-bold text-lime-ink">
          {all ? "Show less" : `See all (${rewards.length})`}
        </button>
      )}
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.title ?? "Reward"}>
        {open && (
          <dl className="flex flex-col divide-y divide-line text-[15px]">
            {[
              ["Amount", amountOf(open)],
              ["Status", historyStatus(open).text],
              ["Won", day(open.created_at)],
              ...(open.description ? [["About", open.description]] : []),
              ...(payoutSummary(open) ? [["Sent", payoutSummary(open)!]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 py-3">
                <dt className="shrink-0 text-muted">{k}</dt>
                <dd className="min-w-0 text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </Sheet>
    </>
  );
}

function ClaimForm({
  reward: r,
  savedBank,
  whatsapp,
  onDone,
}: {
  reward: MyReward;
  savedBank: SavedBank;
  whatsapp: string | null;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ClaimState, FormData>(claimReward, undefined);
  useEffect(() => {
    if (state?.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Editing shows what they sent; a new claim starts from their last bank details.
  const bank = r.payout_bank ?? savedBank.bank ?? "";
  const known = (BANKS as readonly string[]).includes(bank);
  const [choice, setChoice] = useState(bank ? (known ? bank : "Other") : "");

  return (
    <form
      // Submitted by hand rather than with action={…}: React resets a form after an action, which would wipe
      // what the user typed whenever the server says something is wrong.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={r.id} />
      {r.kind === "cash" ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="claim-bank" className="label">
              Bank
            </label>
            <div className="relative">
              <select
                id="claim-bank"
                name="bank"
                required
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                className="field appearance-none pr-10"
              >
                <option value="" disabled>
                  Choose your bank
                </option>
                {BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
                <option value="Other">Other</option>
              </select>
              <ChevronDown size={20} className="pointer-events-none absolute right-4 top-4 text-muted" />
            </div>
          </div>
          {choice === "Other" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="claim-bank-other" className="label">
                Bank name
              </label>
              <input id="claim-bank-other" name="bank_other" required minLength={2} maxLength={40} defaultValue={known ? "" : bank} className="field" />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="claim-account" className="label">
              Account number
            </label>
            <input
              id="claim-account"
              name="account_number"
              required
              inputMode="numeric"
              pattern="\d{10}"
              maxLength={10}
              autoComplete="off"
              placeholder="10 digits"
              defaultValue={r.payout_account_number ?? savedBank.account_number ?? ""}
              className="field tracking-wider"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="claim-name" className="label">
              Account name
            </label>
            <input
              id="claim-name"
              name="account_name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              defaultValue={r.payout_account_name ?? savedBank.account_name ?? ""}
              className="field"
            />
          </div>
          <p className="text-sm leading-normal text-muted">The account name must match your name. Payments go out within 72 hours.</p>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="claim-phone" className="label">
              Phone number for the {r.kind}
            </label>
            <div className="flex gap-2">
              <div className="flex h-13 items-center rounded-[14px] border border-line bg-surface-2 px-3.5 font-medium">+234</div>
              <input
                id="claim-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                required
                placeholder="803 123 4567"
                defaultValue={(r.payout_phone ?? whatsapp ?? "").replace("+234", "0")}
                className="field"
              />
            </div>
          </div>
          <p className="text-sm leading-normal text-muted">Sent within 72 hours. You can change the number until we start sending.</p>
        </>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-pink-ink">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary h-12 text-[15px]">
        {pending ? "Saving…" : r.status === "claimed" ? "Save details" : "Claim reward"}
      </button>
    </form>
  );
}
