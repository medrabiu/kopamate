"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveMoney } from "@/app/actions/hustle";
import { FormError } from "@/components/forms";
import { useToast } from "@/components/Toast";
import { naira } from "@/lib/hustle/types";

/** "Invest in my business" and "Pay myself": pick one, type an amount, confirm. */
export default function MoneyMover({ wallet, cash }: { wallet: number; cash: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"invest" | "draw" | null>(null);
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [toast, show] = useToast();
  const value = Math.round(Number(amount.replace(/[^0-9]/g, "")) || 0);
  const max = mode === "invest" ? wallet : Math.max(0, cash);

  function reset() {
    setMode(null);
    setAmount("");
    setConfirming(false);
    setError(undefined);
  }

  function go() {
    if (!mode) return;
    start(async () => {
      const r = await moveMoney(mode, value);
      if ("error" in r) {
        setError(r.error);
        setConfirming(false);
      } else {
        show(mode === "invest" ? `${naira(value)} moved to your business` : `You paid yourself ${naira(value)}`);
        reset();
        router.refresh();
      }
    });
  }

  if (!mode) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <button type="button" className="h-12 rounded-full border border-lime text-[15px] font-bold text-lime-ink" onClick={() => setMode("invest")}>
          Invest in my business
        </button>
        <button type="button" className="h-12 rounded-full border border-line text-[15px] font-bold" onClick={() => setMode("draw")}>
          Pay myself
        </button>
        {toast}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      <label htmlFor="amount" className="label">
        {mode === "invest" ? "Move from wallet to business" : "Move from business to wallet"} (up to {naira(max)})
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted" aria-hidden="true">
          ₦
        </span>
        <input
          id="amount"
          inputMode="numeric"
          autoFocus
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value.replace(/[^0-9]/g, ""));
            setConfirming(false);
          }}
          className="field pl-9"
          placeholder="5000"
        />
      </div>
      <div className="flex gap-2">
        {[1000, 5000, 10000].filter((n) => n <= max).map((n) => (
          <button key={n} type="button" onClick={() => setAmount(String(n))} className="h-9 rounded-full border border-line px-3 text-[13px] font-bold">
            {naira(n)}
          </button>
        ))}
      </div>
      <FormError message={error} />
      {confirming ? (
        <button type="button" className="btn-primary" onClick={go} disabled={pending}>
          {pending ? "Moving…" : `Yes, move ${naira(value)}`}
        </button>
      ) : (
        <button type="button" className="btn-primary" disabled={value <= 0 || value > max} onClick={() => setConfirming(true)}>
          {value > max ? `You have ${naira(max)}` : "Continue"}
        </button>
      )}
      <button type="button" onClick={reset} className="text-sm font-bold text-muted">
        Cancel
      </button>
    </div>
  );
}
