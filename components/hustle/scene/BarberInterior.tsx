"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { buy } from "@/app/actions/hustle";
import { FormError } from "@/components/forms";
import { useToast } from "@/components/Toast";
import { naira } from "@/lib/hustle/types";
import { ReviewSheet } from "../BuyButton";
import Interior, { at } from "./Interior";
import { lookFor, Owner, type HairState } from "./Person";

type Props = {
  viewerId: string;
  barberId: string;
  barber: string;
  shop: string;
  rating: number;
  reviews: number;
  note: string;
  hair: HairState;
  offer: { listingId: number; price: number; left: number } | null;
  why: string | null;
};

/** Inside a barber's: sit down, pay through the normal purchase, watch the snip, leave with a neat cut. */
export default function BarberInterior(p: Props) {
  const router = useRouter();
  const me = useMemo(() => lookFor(p.viewerId), [p.viewerId]);
  const barber = useMemo(() => lookFor(p.barberId), [p.barberId]);
  const [stage, setStage] = useState<"waiting" | "cutting" | "done">("waiting");
  const [hair, setHair] = useState<HairState>(p.hair);
  const [error, setError] = useState<string>();
  const [orderId, setOrderId] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [toast, show] = useToast();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function sit() {
    if (!p.offer) return;
    setError(undefined);
    start(async () => {
      const r = await buy(p.offer!.listingId, 1);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setStage("cutting");
      const change = r.vibeAfter - r.vibeBefore;
      timer.current = setTimeout(() => {
        setHair("neat");
        setStage("done");
        show(`Fresh cut · −${naira(p.offer!.price)} · ${change > 0 ? `Vibe +${change}` : `Vibe ${r.vibeAfter}%`}`);
        setOrderId(r.orderId);
        router.refresh();
      }, 2200);
    });
  }

  const seated = stage !== "waiting";
  return (
    <div className="-mx-5 -mt-5 flex flex-col">
      <Interior
        wall="#dfe9f5"
        floor="#c9b28c"
        label={`Inside ${p.shop}: a mirror, a price board, a barber's pole and a chair. ${p.barber} is the barber.${seated ? " You're in the chair." : ""}`}
        art={
          <>
            <rect x="110" y="40" width="170" height="130" rx="80" fill="#9fc4e6" stroke="#2b3a4a" strokeWidth="8" />
            <rect x="30" y="50" width="62" height="90" rx="6" fill="#f5f5f0" />
            <text x="61" y="72" textAnchor="middle" fontWeight="800" fontSize="11" fill="#123049" style={{ fontFamily: "var(--font-display)" }}>
              PRICES
            </text>
            <text x="61" y="96" textAnchor="middle" fontWeight="700" fontSize="10" fill="#123049">
              Cut
            </text>
            <text x="61" y="112" textAnchor="middle" fontWeight="800" fontSize="11" fill="#123049">
              {p.offer ? naira(p.offer.price) : "Closed"}
            </text>
            <rect x="330" y="40" width="16" height="140" rx="8" fill="#f5f5f0" />
            <path d="M330 52L346 42M330 72L346 62M330 92L346 82M330 112L346 102M330 132L346 122M330 152L346 142M330 172L346 162" stroke="#e2542b" strokeWidth="6" />
            <rect x="120" y="250" width="150" height="20" rx="6" fill="#1a1a1a" />
            <rect x="150" y="270" width="16" height="40" fill="#555" />
            <rect x="224" y="270" width="16" height="40" fill="#555" />
            <rect x="140" y="306" width="110" height="10" rx="4" fill="#3a3a42" />
            <rect x="128" y="190" width="134" height="64" rx="16" fill="#1a1a1a" />
          </>
        }
      >
        {seated && (
          <div className="hz-pop" style={at(171, 156, 48, 84)} aria-hidden="true">
            <Owner look={{ ...me, shirt: "#f5f5f0" }} hair={hair} apron={false} width={48} />
          </div>
        )}
        <div style={at(262, 196, 56, 104)} aria-hidden="true">
          <Owner look={barber} hair="neat" apron={false} legs width={56} />
          {stage === "cutting" && (
            <div className="absolute -left-6 top-8">
              <svg viewBox="0 0 24 24" width="26" height="26" className="hz-snip">
                <circle cx="6" cy="18" r="3" fill="none" stroke="#f5f5f0" strokeWidth="2.4" />
                <circle cx="16" cy="20" r="3" fill="none" stroke="#f5f5f0" strokeWidth="2.4" />
                <path d="M8 16L20 2M14 18L6 4" stroke="#f5f5f0" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </div>
          )}
          <span className="absolute -top-5 left-1 whitespace-nowrap rounded-md bg-[#0e0e10] px-1.5 py-0.5 text-[10px] font-extrabold text-[#5aa9ff]">{p.barber}</span>
        </div>
      </Interior>

      <div className="flex flex-col gap-2.5 px-5 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="h-display truncate text-[22px]">{p.shop}</h1>
          <span className="shrink-0 text-[13px] text-muted">
            ★ {p.rating.toFixed(1)} · {p.reviews} {p.reviews === 1 ? "review" : "reviews"}
          </span>
        </div>
        <p className="text-sm text-muted" aria-live="polite">
          {stage === "cutting" ? `${p.barber} is cutting your hair…` : stage === "done" ? "Looking sharp. Your hair is sorted." : p.note}
        </p>
        <FormError message={error} />
        {stage === "waiting" &&
          (p.why || !p.offer ? (
            <p className="text-sm text-faint">{p.why ?? "Closed today. Check back tomorrow."}</p>
          ) : (
            <button type="button" className="btn-primary" onClick={sit} disabled={pending || p.offer.left <= 0}>
              {p.offer.left <= 0 ? "No slots left today" : pending ? "Sitting down…" : `Sit down · Haircut ${naira(p.offer.price)}`}
            </button>
          ))}
        {stage === "done" && (
          <button type="button" className="btn-secondary" onClick={() => router.push("/hustle")}>
            Back to my shop
          </button>
        )}
      </div>
      {toast}
      <ReviewSheet orderId={orderId} shop={p.shop} onClose={() => setOrderId(null)} />
    </div>
  );
}
