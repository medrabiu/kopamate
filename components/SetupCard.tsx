"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, CloseIcon } from "./icons";
import { useToast } from "./Toast";
import { enablePush, pushSupport } from "./push-client";
import { PROFILE_STEPS } from "@/lib/badge-meta";
import type { ProfileSteps } from "@/lib/badges";

const DISMISS_KEY = "km_push_prompt_dismissed";
/** After "Not now" on notifications, ask again in a few days. */
const DISMISS_DAYS = 3;

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86400_000;
  } catch {
    return false;
  }
}

/**
 * The notifications step, decided in the browser:
 * "done": allowed (this browser's subscription is quietly re-saved). "ask": not decided yet.
 * "ios": iPhone in Safari, where notifications need Kopamate on the Home Screen.
 * null: left out (blocked, not supported, push not configured, or "Not now" recently).
 */
type PushStep = "done" | "ask" | "ios" | null;

/**
 * Home's "Finish setting up": notifications plus the profile steps (photo, state code, first friend) in one
 * card. Only what's left is listed, with a count and a bar. Gone once everything is done.
 */
export default function SetupCard({ steps, publicKey }: { steps: ProfileSteps; publicKey: string | null }) {
  const [push, setPush] = useState<PushStep>(null);
  const [busy, setBusy] = useState(false);
  const [showIos, setShowIos] = useState(false);
  const [toast, show] = useToast();

  useEffect(() => {
    if (!publicKey) return;
    const support = pushSupport();
    if (support === "ios-install") {
      if (!dismissedRecently()) setPush("ios");
      return;
    }
    if (support !== "ok") return;
    if (Notification.permission === "granted") {
      enablePush(publicKey);
      setPush("done");
    } else if (Notification.permission === "default" && !dismissedRecently()) {
      setPush("ask");
    }
  }, [publicKey]);

  function notNow() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setPush(null);
  }

  async function turnOn() {
    if (!publicKey) return;
    setBusy(true);
    const result = await enablePush(publicKey);
    setBusy(false);
    if (result === "on") {
      setPush("done");
      show("Notifications are on");
    } else if (result === "denied") {
      setPush(null);
    } else {
      show("Couldn't turn on notifications. Try again.");
    }
  }

  const profileLeft = PROFILE_STEPS.filter((s) => !steps[s.key]);
  const total = PROFILE_STEPS.length + (push ? 1 : 0);
  const done = PROFILE_STEPS.length - profileLeft.length + (push === "done" ? 1 : 0);
  if (done === total) return toast;

  const row = "flex min-h-12 w-full items-center gap-3 py-2 text-left";
  const dot = <span aria-hidden="true" className="size-6 shrink-0 rounded-full border-[1.5px] border-line" />;

  return (
    <section className="card flex flex-col gap-3 !p-[18px]" aria-labelledby="setup-title">
      {toast}
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="setup-title" className="h-display text-lg">
          Finish setting up
        </h2>
        <span className="text-sm font-bold text-lime-ink">
          {done} of {total} done
        </span>
      </div>
      <div
        className="h-1.5 rounded-full bg-surface-2"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div className="h-1.5 rounded-full bg-lime" style={{ width: `${Math.max(4, (done / total) * 100)}%` }} />
      </div>
      <ul className="-mb-1 flex flex-col">
        {(push === "ask" || push === "ios") && (
          <li className="border-b border-line last:border-b-0">
            <div className="flex items-center">
              <button
                type="button"
                onClick={push === "ask" ? turnOn : () => setShowIos((v) => !v)}
                disabled={busy}
                aria-expanded={push === "ios" ? showIos : undefined}
                className={`${row} flex-1`}
              >
                {dot}
                <span className="flex-1 text-[15px] font-medium">
                  {busy ? "Turning on…" : "Turn on notifications"}
                  <span className="block text-[13px] font-normal text-muted">So your streak never ends by accident</span>
                </span>
              </button>
              <button type="button" onClick={notNow} aria-label="Not now" className="flex size-11 shrink-0 items-center justify-center text-faint">
                <CloseIcon size={16} />
              </button>
            </div>
            {push === "ios" && showIos && (
              <p className="pb-3 pl-9 text-[13px] text-muted">
                On iPhone, tap Share, then Add to Home Screen. Open Kopamate from there and turn notifications on.
              </p>
            )}
          </li>
        )}
        {profileLeft.map((s) => (
          <li key={s.key} className="border-b border-line last:border-b-0">
            <Link href={s.href} className={row}>
              {dot}
              <span className="flex-1 text-[15px] font-medium">{s.label}</span>
              <ChevronRight size={18} className="shrink-0 text-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
