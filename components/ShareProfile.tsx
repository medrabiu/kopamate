"use client";

import { useEffect, useState } from "react";
import Sheet from "./Sheet";
import { ChatIcon, ShareIcon } from "./icons";
import { logShare } from "./ShareButtons";
import { useToast } from "./Toast";

/** Share your profile link (/u/<code>) on WhatsApp, the phone's share sheet, or by copying it. */
export default function ShareProfile({ link, nickname }: { link: string; nickname: string }) {
  const [toast, show] = useToast();
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && "share" in navigator), []);
  const message = `Follow me (${nickname}) on Kopamate, the app for NYSC corpers: ${link}`;

  async function copy() {
    logShare("profile_copy");
    try {
      await navigator.clipboard.writeText(link);
      show("Profile link copied");
    } catch {
      show(link);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener"
          onClick={() => logShare("profile_whatsapp")}
          className="btn-primary h-11 gap-1.5 px-3 text-[15px]"
        >
          <ChatIcon size={18} />
          WhatsApp
        </a>
        {canShare ? (
          <button
            type="button"
            onClick={async () => {
              logShare("profile_native");
              try {
                await navigator.share({ text: message });
              } catch {}
            }}
            className="btn-secondary h-11 gap-1.5 px-3 text-[15px]"
          >
            <ShareIcon size={18} />
            More
          </button>
        ) : (
          <button type="button" onClick={copy} className="btn-secondary h-11 px-3 text-[15px]">
            Copy link
          </button>
        )}
      </div>
      <div className="flex h-11 items-center gap-1.5 rounded-full border border-line pl-4 pr-1.5">
        <span className="min-w-0 flex-1 truncate text-sm text-muted">{link.replace(/^https?:\/\//, "")}</span>
        <button type="button" onClick={copy} className="h-8 rounded-full bg-surface-2 px-3.5 text-sm font-bold">
          Copy
        </button>
      </div>
      {toast}
    </div>
  );
}

/**
 * A small "Share profile" pill. On phones it opens the share sheet straight away; elsewhere (or if that
 * fails) it opens a small sheet with WhatsApp and Copy.
 */
/** `className` replaces the default small pill (the Profile header uses a full-width button). */
export function ShareProfileButton({ link, nickname, className }: { link: string; nickname: string; className?: string }) {
  const [open, setOpen] = useState(false);
  async function share() {
    logShare("profile_button");
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: `${nickname} on Kopamate`, text: `Follow me (${nickname}) on Kopamate, the app for NYSC corpers`, url: link });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // They closed the share sheet.
      }
    }
    setOpen(true);
  }
  return (
    <>
      <button
        type="button"
        onClick={share}
        className={className ?? "flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm font-bold hover:bg-surface-2"}
      >
        <ShareIcon size={15} />
        Share
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Share your profile">
        <p className="-mt-1 text-sm text-muted">Anyone with the link can follow you. New people who join with it count as your invites.</p>
        <ShareProfile link={link} nickname={nickname} />
      </Sheet>
    </>
  );
}
