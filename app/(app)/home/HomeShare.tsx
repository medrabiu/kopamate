"use client";

import { ChatIcon } from "@/components/icons";
import { logShare } from "@/components/ShareButtons";
import StatusCardButton from "@/components/StatusCardButton";

/** The two ways to share from Home, side by side: a WhatsApp message, or the Status card image. */
export default function HomeShare({ whatsappUrl, cardUrl, message, fileName }: { whatsappUrl: string; cardUrl: string; message: string; fileName: string }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener"
        onClick={() => logShare("whatsapp")}
        className="btn-primary h-12 gap-1.5 px-3 text-[15px]"
      >
        <ChatIcon size={18} />
        WhatsApp
      </a>
      <StatusCardButton cardUrl={cardUrl} message={message} fileName={fileName} className="btn-secondary h-12 gap-1.5 px-3 text-[15px]" />
    </div>
  );
}
