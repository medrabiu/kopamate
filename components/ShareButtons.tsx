"use client";

import { useEffect, useState } from "react";
import { ChatIcon, CopyIcon, ShareIcon } from "./icons";
import { useToast } from "./Toast";

type Props = { link: string; whatsappUrl: string; message: string; variant: "compact" | "full" };

function logShare(channel: string) {
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

  return (
    <div className="flex flex-col gap-3.5">
      <div className="text-[13px] text-muted">Your link</div>
      <div className="flex h-13 items-center gap-2.5 rounded-[14px] bg-bg pl-3.5 pr-1.5">
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{link.replace(/^https?:\/\//, "")}</span>
        <button type="button" onClick={copy} className="h-10 rounded-full bg-surface-2 px-4 text-sm font-bold hover:bg-line">
          Copy
        </button>
      </div>
      {whatsapp}
      {canShare && (
        <button type="button" onClick={nativeShare} className="btn-secondary h-12 text-[15px]">
          <ShareIcon size={18} />
          More ways to share
        </button>
      )}
      {toast}
    </div>
  );
}
