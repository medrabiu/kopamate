"use client";

import { useEffect, useState } from "react";
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
