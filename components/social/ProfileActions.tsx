"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Sheet from "../Sheet";
import { block, follow, removeConnection, report, sayHi } from "@/app/actions/social";
import type { ConnectionState } from "@/lib/social";
import { NOTE_MAX, REPORT_NOTE_MAX, REPORT_REASON_LABEL, REPORT_REASONS } from "@/lib/social-rules";

function logEvent(name: string) {
  try {
    void fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }), keepalive: true });
  } catch {}
}

type Props = {
  id: string;
  nickname: string;
  following: boolean;
  followsYou: boolean;
  connection: ConnectionState;
  /** wa.me link, only for an accepted "Say hi". */
  wa: string | null;
  hiAllowed: boolean;
};

const pill = "flex h-11 items-center justify-center rounded-full px-5 text-[15px] font-bold";

/** Follow, Say hi (or its state), Chat on WhatsApp once connected, and ⋯ for Block, Report and removing a connection. */
export default function ProfileActions({ id, nickname, following, followsYou, connection, wa, hiAllowed }: Props) {
  const router = useRouter();
  const [on, setOn] = useState(following);
  const [conn, setConn] = useState<ConnectionState["status"]>(connection.status);
  const [sheet, setSheet] = useState<"hi" | "more" | "report" | "block" | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const [pending, start] = useTransition();
  // Switching from one sheet to another fires the old sheet's close late: only close if it's still the open one.
  const closeIf = (which: NonNullable<typeof sheet>) => setSheet((s) => (s === which ? null : s));

  function toggleFollow() {
    const next = !on;
    setOn(next);
    setMessage(null);
    start(async () => {
      const r = await follow(id, next).catch(() => ({ ok: false as const, error: "Couldn't save. Check your connection." }));
      if (!r.ok) {
        setOn(!next);
        setMessage({ text: r.error, bad: true });
      } else router.refresh();
    });
  }

  function sendHi() {
    start(async () => {
      const r = await sayHi(id, note).catch(() => ({ ok: false as const, error: "Couldn't send. Check your connection." }));
      if (r.ok) {
        setConn("sent");
        setSheet(null);
        setMessage({ text: `Sent. If ${nickname} says hi back, you'll both see a WhatsApp button here.` });
      } else setMessage({ text: r.error, bad: true });
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={toggleFollow}
          disabled={pending}
          aria-pressed={on}
          className={`${pill} flex-1 ${on ? "border border-line" : "bg-ink text-bg"}`}
        >
          {on ? "Following" : followsYou ? "Follow back" : "Follow"}
        </button>
        {conn === "none" && hiAllowed && (
          <button type="button" onClick={() => setSheet("hi")} className={`${pill} flex-1 border border-line`}>
            👋 Say hi
          </button>
        )}
        {conn === "sent" && (
          <span className={`${pill} flex-1 border border-line text-muted`} aria-label="Say hi: pending">
            Pending
          </span>
        )}
        {conn === "received" && (
          <a href="/notifications" className={`${pill} flex-1 bg-lime text-on-accent`}>
            Answer their hi
          </a>
        )}
        <button type="button" onClick={() => setSheet("more")} aria-label="More options" className={`${pill} border border-line !px-4`}>
          ⋯
        </button>
      </div>
      {conn === "connected" && wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => logEvent("wa_open")}
          className={`${pill} bg-[#25D366] text-[#0e0e10]`}
        >
          Chat on WhatsApp
        </a>
      )}
      {conn === "connected" && !wa && <p className="text-sm text-muted">You&apos;re connected. {nickname} hasn&apos;t added a WhatsApp number.</p>}
      {message && (
        <p role={message.bad ? "alert" : "status"} className={`text-sm ${message.bad ? "text-pink-ink" : "text-muted"}`}>
          {message.text}
        </p>
      )}

      <Sheet open={sheet === "hi"} onClose={() => closeIf("hi")} title={`Say hi to ${nickname}`}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Add a short note so they know who you are. If they say hi back, you&apos;ll both see each other&apos;s WhatsApp button.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
            rows={3}
            placeholder="Hi, I'm also from UNILAG, Computer Science…"
            className="field h-auto py-3"
            aria-label="Note (optional)"
          />
          <span className="-mt-2 text-right text-xs text-faint">
            {note.length}/{NOTE_MAX} · no links
          </span>
          {message?.bad && <p role="alert" className="text-sm text-pink-ink">{message.text}</p>}
          <button type="button" onClick={sendHi} disabled={pending} className="btn-primary h-12 text-[15px]">
            {pending ? "Sending…" : "Send"}
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === "more"} onClose={() => closeIf("more")} title="More">
        <div className="flex flex-col gap-2">
          {conn === "connected" && (
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  const r = await removeConnection(id);
                  if (r.ok) {
                    setConn("none");
                    setSheet(null);
                    setMessage({ text: "Connection removed. The WhatsApp button is gone for both of you." });
                    router.refresh();
                  }
                })
              }
              className="h-12 rounded-2xl border border-line px-4 text-left font-bold"
            >
              Remove connection
            </button>
          )}
          <button type="button" onClick={() => setSheet("report")} className="h-12 rounded-2xl border border-line px-4 text-left font-bold">
            Report {nickname}
          </button>
          <button type="button" onClick={() => setSheet("block")} className="h-12 rounded-2xl border border-pink/50 px-4 text-left font-bold text-pink-ink">
            Block {nickname}
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === "block"} onClose={() => closeIf("block")} title={`Block ${nickname}?`}>
        <div className="flex flex-col gap-3">
          <p className="text-[15px] leading-relaxed text-muted">
            You won&apos;t see each other anywhere on Kopamate, and you&apos;ll stop following each other. They aren&apos;t told. You can unblock
            them in Settings.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await block(id);
                if (r.ok) router.replace("/corpers");
                else setMessage({ text: r.error, bad: true });
              })
            }
            className="h-12 rounded-full bg-pink font-bold text-on-accent"
          >
            {pending ? "Blocking…" : "Block"}
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === "report"} onClose={() => closeIf("report")} title={`Report ${nickname}`}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Only the Kopamate team sees reports. {nickname} isn&apos;t told who reported them.</p>
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Reason</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r} className={`flex h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 ${reason === r ? "border-lime" : "border-line"}`}>
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-lime" />
                <span className="font-medium">{REPORT_REASON_LABEL[r]}</span>
              </label>
            ))}
          </fieldset>
          <textarea
            value={reportNote}
            onChange={(e) => setReportNote(e.target.value.slice(0, REPORT_NOTE_MAX))}
            rows={3}
            placeholder="Anything we should know? (optional)"
            className="field h-auto py-3"
            aria-label="Details (optional)"
          />
          {message?.bad && <p role="alert" className="text-sm text-pink-ink">{message.text}</p>}
          <button
            type="button"
            disabled={pending || !reason}
            onClick={() =>
              start(async () => {
                const r = await report(id, reason, reportNote);
                if (r.ok) {
                  setSheet(null);
                  setMessage({ text: "Thanks. Our team will look at it." });
                } else setMessage({ text: r.error, bad: true });
              })
            }
            className="btn-primary h-12 text-[15px]"
          >
            Send report
          </button>
        </div>
      </Sheet>
    </div>
  );
}
