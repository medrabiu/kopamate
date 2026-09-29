"use client";

import { useState } from "react";
import { ShareIcon } from "./icons";
import { logShare } from "./ShareButtons";
import { useToast } from "./Toast";

/** Shares the Status card image (native share sheet on phones), or downloads it where file sharing isn't supported. */
export default function StatusCardButton({ cardUrl, message, fileName }: { cardUrl: string; message: string; fileName: string }) {
  const [toast, show] = useToast();
  const [busy, setBusy] = useState(false);

  async function post() {
    logShare("status_card");
    setBusy(true);
    try {
      const res = await fetch(cardUrl);
      if (!res.ok) throw new Error("card");
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: message });
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return; // They closed the share sheet.
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      show("Card saved. Add it to your WhatsApp Status.");
    } catch {
      show("Couldn't load your card. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={post} disabled={busy} className="btn-primary h-12 text-[15px]">
        <ShareIcon size={18} />
        {busy ? "Getting card…" : "Post to Status"}
      </button>
      {toast}
    </>
  );
}
