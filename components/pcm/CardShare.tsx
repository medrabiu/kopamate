"use client";

import { useState } from "react";

/** Share a link with the phone's share sheet; otherwise copy it, or open WhatsApp. */
export default function CardShare({ url, text, className }: { url: string; text: string; className: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      void fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "checklist_share" }), keepalive: true });
    } catch {}
    try {
      if (navigator.share) return void (await navigator.share({ text, url }));
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener");
    }
  }
  return (
    <button type="button" onClick={share} className={className}>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
