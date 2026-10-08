"use client";

import { useState, useTransition } from "react";
import { respondHi } from "@/app/actions/social";

/**
 * Accept / Ignore on a "Say hi" in Notifications. Accepting first shows what it means (both WhatsApp numbers
 * become visible to each other); nothing is shared until the person confirms.
 */
export default function HiResponse({ connectionId, nickname }: { connectionId: number; nickname: string }) {
  const [step, setStep] = useState<"ask" | "confirm" | "accepted" | "ignored">("ask");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const answer = (accept: boolean) =>
    start(async () => {
      const r = await respondHi(connectionId, accept).catch(() => ({ ok: false as const, error: "Couldn't save. Check your connection." }));
      if (r.ok) setStep(accept ? "accepted" : "ignored");
      else setError(r.error);
    });

  if (step === "accepted") {
    return (
      <p className="text-sm font-bold text-lime-ink">
        Connected. Open {nickname}&apos;s profile to chat on WhatsApp.
      </p>
    );
  }
  if (step === "ignored") return <p className="text-sm text-muted">Ignored. {nickname} won&apos;t be told.</p>;

  return (
    <div className="flex flex-col gap-2">
      {step === "confirm" && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
          Accepting lets <b>{nickname}</b> see your WhatsApp number, and you&apos;ll see theirs.
        </p>
      )}
      <div className="flex gap-2">
        {step === "ask" ? (
          <button type="button" onClick={() => setStep("confirm")} className="h-9 rounded-full bg-lime px-4 text-sm font-bold text-on-accent">
            Accept
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => answer(true)} className="h-9 rounded-full bg-lime px-4 text-sm font-bold text-on-accent">
            {pending ? "…" : "Yes, accept"}
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => (step === "confirm" ? setStep("ask") : answer(false))} className="h-9 rounded-full border border-line px-4 text-sm font-bold">
          {step === "confirm" ? "Cancel" : "Ignore"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-pink-ink">
          {error}
        </p>
      )}
    </div>
  );
}
