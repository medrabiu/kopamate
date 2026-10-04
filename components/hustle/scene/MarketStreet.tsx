"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buy } from "@/app/actions/hustle";
import { FormError } from "@/components/forms";
import { useToast } from "@/components/Toast";
import { naira } from "@/lib/hustle/types";
import { ReviewSheet } from "../BuyButton";
import { lookFor, SKY, Walker } from "./Person";
import StreetBuilding from "./StreetBuilding";
import type { Family } from "./ShopStage";

export type StreetShop = {
  id: string;
  slug: string;
  name: string;
  color: string;
  icon: string;
  family: Family;
  typeName: string;
  owner: string;
  rating: number;
  mine: boolean;
  open: boolean;
  /** Sold today, for the queue of little figures. */
  sold: number;
  note: string;
  /** The barber has its own interior; everyone else opens a buy sheet. */
  interior: boolean;
  offer: { listingId: number; item: string; price: number; left: number; cta: string; payNote: string; multi: boolean } | null;
  /** Why this player can't buy here (other state, wrong supplies, own shop), or null. */
  why: string | null;
};

/** The market street: every player business in the state as a building. Tap one to walk in. */
export default function MarketStreet({ state, shops, listHref, sky }: { state: string; shops: StreetShop[]; listHref: string | null; sky: keyof typeof SKY }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<StreetShop | null>(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string>();
  const [orderId, setOrderId] = useState<{ id: number; shop: string } | null>(null);
  const [pending, start] = useTransition();
  const [toast, show] = useToast();
  const width = Math.max(390, shops.length * 180 + 40);

  function close() {
    setSheet(null);
    setQty(1);
    setError(undefined);
  }

  return (
    <div className="-mx-5 flex flex-col">
      <div className="no-scrollbar overflow-x-auto overflow-y-hidden" style={{ background: SKY[sky] }}>
        <div className="relative" style={{ width, height: 380 }}>
          <svg viewBox={`0 0 ${width} 380`} width={width} height="380" className="absolute inset-0" aria-hidden="true">
            {sky === "night" ? <circle cx="90" cy="50" r="16" fill="#e8ecff" opacity="0.9" /> : <circle cx="90" cy="50" r="24" fill="#fff3d6" />}
            <rect x="0" y="290" width={width} height="14" fill="#c9b28c" />
            <rect x="0" y="300" width={width} height="80" fill="#4a3424" />
            <path d={`M0 342H${width}`} stroke="#f2c230" strokeWidth="4" strokeDasharray="30 26" />
          </svg>
          {shops.map((s, i) => {
            const left = 20 + i * 180;
            const queue = s.open ? Math.min(4, Math.ceil(s.sold / 3)) : 0;
            const label = s.mine ? `${s.name}, your shop` : s.interior ? `Enter ${s.name}` : `${s.name}, ${s.typeName}. ${s.note}`;
            const building = (
              <>
                <StreetBuilding family={s.family} name={s.name} color={s.color} icon={s.icon} open={s.open} />
                <span
                  className={`absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                    s.mine ? "bg-lime text-on-accent" : "bg-surface-2 " + (s.open ? "text-lime-ink" : "text-muted")
                  }`}
                >
                  {s.mine ? "YOU" : s.note}
                </span>
              </>
            );
            return (
              <div key={s.id}>
                {s.mine ? (
                  <Link href="/hustle" aria-label={label} className="absolute block" style={{ left, top: 118, width: 160 }}>
                    {building}
                  </Link>
                ) : s.interior ? (
                  <Link href={`/hustle/b/${s.slug}`} aria-label={label} className="absolute block" style={{ left, top: 118, width: 160 }}>
                    {building}
                  </Link>
                ) : (
                  <button type="button" aria-label={label} onClick={() => setSheet(s)} className="absolute block text-left" style={{ left, top: 118, width: 160 }}>
                    {building}
                  </button>
                )}
                {Array.from({ length: queue }, (_, q) => (
                  <div key={q} className="absolute" style={{ left: left + 40 + q * 24, top: 316 }} aria-hidden="true">
                    <div className={q % 2 ? "" : "hz-bob"}>
                      <Walker look={lookFor(`${s.id}|q${q}`)} width={20} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-4">
        <span className="text-xs font-extrabold tracking-[0.1em] text-muted">MARKET STREET · {state.toUpperCase()}</span>
        <p className="text-[15px] leading-snug">
          {shops.length ? "Swipe along the street. Every shop is run by a real player. Tap one to walk in." : `No businesses on this street in ${state} yet.`}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1.5">
            <span className="h-2 w-2 rounded-full bg-lime" aria-hidden="true" />
            Open
          </span>
          <span className="rounded-full bg-surface-2 px-2.5 py-1.5">Figures = customers today</span>
          {listHref && (
            <Link href={listHref} className="ml-auto rounded-full border border-line px-3 py-1.5 font-bold">
              List view
            </Link>
          )}
        </div>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={sheet.name}
            onClick={(e) => e.stopPropagation()}
            className="hz-pop mx-auto flex w-full max-w-[480px] flex-col gap-3 rounded-t-[28px] bg-surface-2 px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="h-display truncate text-[22px]">{sheet.name}</span>
              <span className="shrink-0 text-[13px] text-muted">★ {sheet.rating.toFixed(1)}</span>
            </div>
            <span className="text-sm text-muted">
              {sheet.typeName} · Run by {sheet.owner} · {sheet.note}
            </span>
            {sheet.offer ? (
              <div className="flex items-center gap-3 rounded-2xl bg-bg px-3.5 py-3">
                <span className="flex-1 text-[15px] font-bold">{sheet.offer.item}</span>
                <span className="text-[15px] font-extrabold">{naira(sheet.offer.price * qty)}</span>
              </div>
            ) : (
              <p className="rounded-2xl bg-bg px-3.5 py-3 text-sm text-muted">Closed today. Check back tomorrow.</p>
            )}
            {sheet.offer && sheet.offer.multi && !sheet.why && (
              <div className="flex items-center justify-center gap-3" aria-label="How many">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-11 w-11 rounded-full bg-line text-xl" aria-label="One fewer">
                  −
                </button>
                <span className="w-8 text-center font-bold tabular-nums">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(sheet.offer!.left, q + 1))} className="h-11 w-11 rounded-full bg-line text-xl" aria-label="One more">
                  +
                </button>
              </div>
            )}
            <span className="text-xs text-faint">{sheet.why ?? sheet.offer?.payNote}</span>
            <FormError message={error} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={close} className="h-[52px] rounded-full border border-line text-[15px] font-bold">
                Not now
              </button>
              <button
                type="button"
                disabled={!sheet.offer || Boolean(sheet.why) || sheet.offer.left <= 0 || pending}
                onClick={() =>
                  start(async () => {
                    const r = await buy(sheet.offer!.listingId, qty);
                    if ("error" in r) setError(r.error);
                    else {
                      show(r.message);
                      setOrderId({ id: r.orderId, shop: sheet.name });
                      close();
                      router.refresh();
                    }
                  })
                }
                className="h-[52px] rounded-full bg-lime text-[15px] font-extrabold text-on-accent disabled:opacity-50"
              >
                {pending ? "…" : sheet.offer && sheet.offer.left <= 0 ? "Sold out" : (sheet.offer?.cta ?? "Closed")}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast}
      <ReviewSheet orderId={orderId?.id ?? null} shop={orderId?.shop ?? ""} onClose={() => setOrderId(null)} />
    </div>
  );
}
