"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buy, buyFromBackup, review } from "@/app/actions/hustle";
import { FormError } from "@/components/forms";
import Sheet from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { naira } from "@/lib/hustle/types";

/** After a purchase: 1 to 5 stars and an optional short note. Skippable. */
export function ReviewSheet({ orderId, shop, onClose }: { orderId: number | null; shop: string; onClose: () => void }) {
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Sheet open={orderId !== null} onClose={onClose} title={`Rate ${shop}`}>
      <div className="flex flex-col gap-4">
        <div className="flex justify-center gap-2" role="radiogroup" aria-label="Stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => setStars(n)}
              className={`text-4xl leading-none ${n <= stars ? "text-lime-ink" : "text-line"}`}
            >
              ★
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 140))}
          placeholder="Anything to add? (optional)"
          rows={2}
          className="field h-auto py-3"
          aria-label="Short review"
        />
        <FormError message={error} />
        <button
          type="button"
          className="btn-primary"
          disabled={!stars || pending}
          onClick={() =>
            start(async () => {
              const r = await review(orderId!, stars, text);
              if ("error" in r) setError(r.error);
              else {
                onClose();
                router.refresh();
              }
            })
          }
        >
          {pending ? "Sending…" : "Send review"}
        </button>
        <button type="button" onClick={onClose} className="text-sm font-bold text-muted">
          Not now
        </button>
      </div>
    </Sheet>
  );
}

type Props = {
  listingId: number;
  shop: string;
  price: number;
  left: number;
  label: string;
  /** Supplies can be ordered several at a time; needs and services one at a time. */
  multi?: boolean;
  payNote: string;
};

/** Buy / Book / Order with a confirm step, then a review prompt. */
export default function BuyButton({ listingId, shop, price, left, label, multi = false, payNote }: Props) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [orderId, setOrderId] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [toast, show] = useToast();

  function go() {
    setError(undefined);
    start(async () => {
      const r = await buy(listingId, qty);
      setConfirming(false);
      if ("error" in r) setError(r.error);
      else {
        show(r.message);
        setOrderId(r.orderId);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {confirming ? (
        <div className="flex items-center gap-2">
          {multi && (
            <div className="flex items-center rounded-full border border-line" aria-label="How many">
              <button type="button" className="h-11 w-9 text-lg" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="One fewer">
                −
              </button>
              <span className="w-6 text-center text-sm font-bold tabular-nums">{qty}</span>
              <button type="button" className="h-11 w-9 text-lg" onClick={() => setQty((q) => Math.min(left, q + 1))} aria-label="One more">
                +
              </button>
            </div>
          )}
          <button type="button" onClick={go} disabled={pending} className="h-11 rounded-full bg-lime px-4 text-sm font-bold text-on-accent">
            {pending ? "…" : `Pay ${naira(price * qty)}`}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={left <= 0}
          className="h-11 rounded-full bg-lime px-4 text-sm font-bold text-on-accent disabled:bg-surface-2 disabled:text-muted"
        >
          {left <= 0 ? "Sold out" : label}
        </button>
      )}
      {confirming && <span className="text-xs text-faint">{payNote}</span>}
      {error && (
        <p role="alert" className="max-w-[240px] text-right text-xs text-pink-ink">
          {error}
        </p>
      )}
      {toast}
      <ReviewSheet orderId={orderId} shop={shop} onClose={() => setOrderId(null)} />
    </div>
  );
}

/** For a need nobody in the state sells today. */
export function BackupButton({ need, label, price }: { need: string; label: string; price: number }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [toast, show] = useToast();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        className="btn-secondary"
        onClick={() =>
          start(async () => {
            const r = await buyFromBackup(need);
            if ("error" in r) setError(r.error);
            else {
              show(r.message);
              router.refresh();
            }
          })
        }
      >
        {pending ? "Buying…" : `Backup shop · ${label} ${naira(price)}`}
      </button>
      <FormError message={error} />
      {toast}
    </div>
  );
}
