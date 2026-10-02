"use client";

import { useState } from "react";

/** Copies a value (account number, name, phone) for pasting into a banking app. */
export default function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className="ml-1 rounded border border-line px-1.5 text-[11px] font-bold text-muted hover:text-ink"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
