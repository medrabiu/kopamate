"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setLiteMode } from "@/app/actions/hustle";

/** "Lite mode: simpler screens, less data". Saved on the account, so it follows the player to other phones. */
export default function LiteToggle({ on }: { on: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(on);
  const [pending, start] = useTransition();
  function toggle() {
    const next = !value;
    setValue(next);
    start(async () => {
      await setLiteMode(next);
      router.refresh();
    });
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={pending}
      onClick={toggle}
      className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-left"
    >
      <span className="flex flex-col">
        <span className="text-[15px] font-bold">Lite mode</span>
        <span className="text-[13px] text-muted">Simpler screens, less data</span>
      </span>
      <span aria-hidden="true" className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${value ? "bg-lime" : "bg-line"}`}>
        <span className={`h-5 w-5 rounded-full transition-transform ${value ? "translate-x-5 bg-on-accent" : "bg-ink"}`} />
      </span>
    </button>
  );
}
