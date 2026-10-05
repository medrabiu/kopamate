"use client";

import { useState } from "react";
import { CopyIcon } from "../icons";

/** An entry's own link, shown in full with a Copy button. */
export default function CopyLink({ url, label = "Copy your entry link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2 py-1.5 pr-1.5 pl-3.5">
      <span className="min-w-0 flex-1 truncate text-sm font-medium" title={url}>
        {url.replace(/^https?:\/\//, "")}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={label}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-lime px-4 text-sm font-bold text-on-accent"
      >
        <CopyIcon size={16} />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
