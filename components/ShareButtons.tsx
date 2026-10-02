"use client";

import { useEffect, useState } from "react";
import { ChatIcon, CopyIcon, ShareIcon } from "./icons";
import { useToast } from "./Toast";

type Props = { link: string; whatsappUrl: string; message: string; variant: "compact" | "full" };

export function logShare(channel: string) {
  try {
    const body = JSON.stringify({ name: "share_clicked", meta: { channel } });
    if (!navigator.sendBeacon?.("/api/event", new Blob([body], { type: "application/json" }))) {
      fetch("/api/event", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
    }
  } catch {}
}

export default function ShareButtons({ link, whatsappUrl, message, variant }: Props) {
  const [toast, show] = useToast();
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && "share" in navigator), []);

  async function copy() {
    logShare("copy");
    try {
      await navigator.clipboard.writeText(link);
      show("Link copied");
    } catch {
      show(link);
    }
  }

  async function nativeShare() {
    logShare("native");
    try {
      await navigator.share({ text: message });
    } catch {}
  }

  const whatsapp = (
    <a href={whatsappUrl} target="_blank" rel="noopener" onClick={() => logShare("whatsapp")} className="btn-primary h-13 text-base">
      <ChatIcon size={20} />
      Share on WhatsApp
    </a>
  );

  if (variant === "compact") {
    return (
      <div className="flex gap-2.5">
        <div className="flex-1">{whatsapp}</div>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy your link"
          className="flex size-13 shrink-0 items-center justify-center rounded-full border border-line text-ink hover:bg-surface-2"
        >
          <CopyIcon size={20} />
        </button>
        {toast}
      </div>
    );
  }

  // Full: WhatsApp first, then one slim row with the link, Copy and (where supported) the phone's share sheet.
  return (
    <div className="flex flex-col gap-2.5">
      {whatsapp}
      <div className="flex h-12 items-center gap-1.5 rounded-full bg-bg pl-4 pr-1.5">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted">{link.replace(/^https?:\/\//, "")}</span>
        <button type="button" onClick={copy} className="h-9 rounded-full bg-surface-2 px-4 text-sm font-bold hover:bg-line">
          Copy
        </button>
        {canShare && (
          <button
            type="button"
            onClick={nativeShare}
            aria-label="More ways to share"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 hover:bg-line"
          >
            <ShareIcon size={16} />
          </button>
        )}
      </div>
      {toast}
    </div>
  );
}
