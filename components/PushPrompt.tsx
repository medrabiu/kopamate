"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "./icons";
import { useToast } from "./Toast";
import { enablePush, pushSupport } from "./push-client";

const DISMISS_KEY = "km_push_prompt_dismissed";
/** After "Not now", ask again in a few days. */
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
 * Home's soft ask for notifications, before the browser's own prompt (which can only be asked once).
 * Already allowed: quietly makes sure this browser's subscription is saved. iPhone in Safari: explains
 * that notifications need Kopamate on the Home Screen. Renders nothing otherwise.
 */
export default function PushPrompt({ publicKey }: { publicKey: string }) {
  const [mode, setMode] = useState<"ask" | "ios" | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, show] = useToast();

  useEffect(() => {
    const support = pushSupport();
    if (support === "ios-install") {
      if (!dismissedRecently()) setMode("ios");
      return;
    }
    if (support !== "ok") return;
    if (Notification.permission === "granted") {
      enablePush(publicKey);
      return;
    }
    if (Notification.permission === "default" && !dismissedRecently()) setMode("ask");
  }, [publicKey]);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setMode(null);
  }

  async function turnOn() {
    setBusy(true);
    const result = await enablePush(publicKey);
    setBusy(false);
    if (result === "on") {
      setMode(null);
      show("Notifications are on");
    } else if (result === "denied") {
      setMode(null);
    } else {
      show("Couldn't turn on notifications. Try again.");
    }
  }

  if (!mode) return toast;
  return (
    <section className="card relative flex flex-col gap-3 !p-4" aria-label="Notifications">
      {toast}
      <button type="button" onClick={dismiss} aria-label="Not now" className="absolute right-1 top-1 flex size-11 items-center justify-center text-muted">
        <CloseIcon size={18} />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <span className="text-2xl leading-none" aria-hidden="true">
          🔔
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-[15px] font-bold">Never lose your streak</p>
          <p className="text-[13px] text-muted">
            {mode === "ios"
              ? "On iPhone, tap Share, then Add to Home Screen. Open Kopamate from there to turn on notifications."
              : "A reminder before your streak ends, League results, and friends who join with your link. Nothing else."}
          </p>
        </div>
      </div>
      {mode === "ask" && (
        <button type="button" onClick={turnOn} disabled={busy} className="btn-primary h-11 text-[15px]">
          {busy ? "Turning on…" : "Turn on notifications"}
        </button>
      )}
    </section>
  );
}
