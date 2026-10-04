"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { buy, openShop } from "@/app/actions/hustle";
import { FormError } from "@/components/forms";
import { ChevronLeft } from "@/components/icons";
import type { DaySummary } from "@/lib/hustle/business";
import { townCustomers } from "@/lib/hustle/engine";
import { naira, signedNaira } from "@/lib/hustle/types";
import DayResults, { type ResultsType } from "../DayResults";
import { lookFor, type HairState } from "./Person";
import ShopStage, { type Family, type StageWalker } from "./ShopStage";

export type ScenePlan = {
  userId: string;
  name: string;
  color: string;
  icon: string;
  family: Family;
  category: string;
  sky: string;
  night: boolean;
  hair: HairState;
  dayNo: number;
  cash: number;
  unit: string;
  kind: "consumer" | "supplier" | "b2b";
  perishable: boolean;
  capacity: number;
  min: number;
  max: number;
  step: number;
  refPrice: number;
  base: number;
  rivalsWeight: number;
  rivalLow: number | null;
  rivalHigh: number | null;
  card: { id: number; slug: string | null; prompt: string; options: string[] } | null;
  supplyName: string | null;
  inventoryLots: number;
  stockLotCost: number;
  suppliers: { listingId: number; name: string; rating: number; price: number; left: number }[];
  upl: number;
  normalLot: number;
  backupLot: number;
  running: number;
  fixed: number;
  salvagePct: number;
  results: ResultsType;
};

/** Who walks up with today's decision. */
const CARD_CHARACTER: Record<string, string> = {
  credit: "A regular",
  levy: "LG officer",
  bulk_discount: "Your supplier",
  helper_raise: "Your helper",
  price_war: "Neighbour",
  complaint: "Upset customer",
  nepa: "Neighbour",
};

type Played = { day: DaySummary; rating: number; buyers: string[] };

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/**
 * Touch planning: the same plan as the text screen (units, price, supplies, decision), set on the shop scene.
 * "Roll up the shutter" calls the same openShop action; the replay afterwards is built only from what it returns.
 */
export default function PlanScene({ p }: { p: ScenePlan }) {
  const router = useRouter();
  const owner = useMemo(() => lookFor(p.userId), [p.userId]);
  // ₦50 steps, or the type's own step when ₦50 is too coarse (a POS cash-out is ₦100).
  const step = p.refPrice >= 300 ? Math.max(50, p.step) : p.step;
  const snap = (v: number) => Math.min(p.max, Math.max(p.min, Math.round(v / step) * step));
  const startPrice = snap(p.rivalLow && p.rivalHigh ? (p.rivalLow + p.rivalHigh) / 2 : p.refPrice);
  const [price, setPrice] = useState(startPrice);
  const [units, setUnits] = useState(() => Math.min(p.capacity, Math.round(townCustomers(p.base, p.refPrice, startPrice, p.rivalsWeight))));
  const [supplier, setSupplier] = useState<number | null>(p.suppliers[0]?.listingId ?? null);
  const [choice, setChoice] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [played, setPlayed] = useState<Played | null>(null);
  const [phase, setPhase] = useState<"plan" | "replay" | "results">("plan");
  const [beat, setBeat] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const supplierKind = p.kind === "supplier";
  const expected = Math.round(townCustomers(p.base, p.refPrice, price, p.rivalsWeight));
  const lotsNeeded = p.upl ? units / p.upl : 0;
  const lotsToBuy = p.upl ? Math.max(0, Math.ceil(lotsNeeded - p.inventoryLots - 1e-9)) : 0;
  const chosen = p.suppliers.find((s) => s.listingId === supplier) ?? null;
  const lotPrice = chosen ? chosen.price : p.backupLot;
  const sold = Math.min(expected, units);
  const upFront = supplierKind || p.perishable;
  const goods = Math.round(
    upFront
      ? (p.upl ? Math.min(p.inventoryLots, lotsNeeded) * p.stockLotCost + lotsToBuy * lotPrice : 0) + units * p.running
      : (p.upl ? (sold / p.upl) * (p.inventoryLots > 0 ? p.stockLotCost : lotPrice) : 0) + sold * p.running,
  );
  const salvage = supplierKind ? Math.round((units - sold) * price * p.salvagePct) : 0;
  const profit = sold * price + salvage - goods - p.fixed;

  function roll() {
    if (p.card && choice === null) {
      setError("Answer first: what do you tell them?");
      return;
    }
    setError(undefined);
    start(async () => {
      // Buying from the chosen player supplier first is the same "Order" as on the text screen.
      if (chosen && lotsToBuy > 0) {
        const r = await buy(chosen.listingId, Math.min(chosen.left, lotsToBuy));
        if ("error" in r) {
          setError(`${chosen.name}: ${r.error}`);
          return;
        }
      }
      const r = await openShop({ units, price, card: p.card?.id ?? null, choice });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setPlayed({ day: r.day, rating: r.rating, buyers: r.buyers });
      setPhase("replay");
      play(r.day);
    });
  }

  /** The replay's beats: one per customer figure, timed to last about 4 to 6 seconds in all. */
  function play(d: DaySummary) {
    const figures = Math.min(10, d.town_demand + d.units_sold_players);
    const every = figures ? Math.min(420, Math.max(250, 3600 / figures)) : 0;
    timers.current.push(setTimeout(() => {
      for (let i = 1; i <= figures; i++) timers.current.push(setTimeout(() => setBeat(i), i * every));
      timers.current.push(setTimeout(() => setPhase("results"), figures * every + 700));
    }, 1100));
  }

  function skip() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setBeat(99);
    setPhase("results");
  }

  // Replay figures, scaled from the server's numbers (the exact numbers are always shown as text).
  let walkers: StageWalker[] = [];
  let items = units;
  let soldOut = false;
  let line = "";
  if (played) {
    const d = played.day;
    const came = d.town_demand + d.units_sold_players;
    const served = d.units_sold_town + d.units_sold_players;
    const forSale = d.units_prepared - d.units_credit;
    const figures = Math.min(10, came);
    const servedFigures = came ? Math.min(figures, Math.round((served / came) * figures)) : 0;
    const now = Math.min(beat, figures);
    const servedNow = Math.min(now, servedFigures);
    const servedUnits = figures ? Math.round((servedNow / Math.max(1, servedFigures)) * served) : 0;
    items = Math.max(0, forSale - servedUnits);
    soldOut = now > 0 && items === 0 && forSale > 0;
    walkers = Array.from({ length: figures }, (_, i) => {
      const look = lookFor(`${p.userId}|${d.day_date}|${i}`);
      const tag = i === 0 && played.buyers[0] ? `${played.buyers[0]} (player)` : undefined;
      if (i < now) return i < servedFigures ? { key: String(i), left: -60, look, tag } : { key: String(i), left: 430, opacity: 0.5, look };
      const q = i - now;
      return { key: String(i), left: q > 6 ? 430 : 196 + q * 30, bob: q !== 0, look, tag };
    });
    line =
      now >= figures
        ? came > served
          ? `Sold out. ${plural(came - served, "customer")} walked away.`
          : forSale > served
            ? `${plural(forSale - served, p.unit)} left for players until midnight.`
            : "Everyone was served."
        : "Customers are coming in…";
  } else if (p.card && choice === null && CARD_CHARACTER[p.card.slug ?? ""]) {
    walkers = [{ key: "card", left: 196, bob: true, look: lookFor(`${p.userId}|card|${p.card.id}`), tag: CARD_CHARACTER[p.card.slug ?? ""] }];
  }
  const stageState = phase === "plan" ? "preparing" : "open";
  const bubble = phase === "plan" && p.card && choice === null ? p.card.prompt : null;

  return (
    <div className="-mx-5 -mt-5 flex flex-col">
      <div className="flex items-center gap-2 px-5 py-3">
        {phase === "plan" && (
          <Link href="/hustle" aria-label="Back to my business" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line">
            <ChevronLeft size={20} />
          </Link>
        )}
        <span className="h-display min-w-0 flex-1 truncate text-xl">{phase === "plan" ? `Plan day ${p.dayNo}` : p.name}</span>
        <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1.5 text-xs font-bold">Shop {naira(p.cash)}</span>
      </div>

      <div className="relative">
        <ShopStage
          name={p.name}
          color={p.color}
          icon={p.icon}
          family={p.family}
          sky={p.sky}
          night={p.night}
          state={stageState}
          owner={owner}
          hair={p.hair}
          items={items}
          steam={p.category === "food"}
          generator={phase !== "plan" || (p.card?.slug === "nepa" && choice === 0)}
          walkers={walkers}
          soldOut={soldOut}
          bubble={bubble}
          label={phase === "plan" ? `${p.name}, shutter half up, ${plural(units, p.unit)} on the counter.` : `${p.name} is open. ${line}`}
        />
        {phase === "replay" && (
          <button type="button" onClick={skip} className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white">
            Skip
          </button>
        )}
      </div>

      {phase === "plan" && (
        <div className="flex flex-col gap-3 px-5 pt-4">
          {p.supplyName && (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={`Where to buy ${p.supplyName} supplies`}>
              {[...p.suppliers.slice(0, 1).map((s) => ({ id: s.listingId as number | null, name: s.name, sub: `Player · ★ ${s.rating.toFixed(1)}`, price: s.price, player: true })),
                { id: null, name: "Backup market", sub: "Always available", price: p.backupLot, player: false }].map((c) => (
                <button
                  key={c.id ?? "backup"}
                  type="button"
                  role="radio"
                  aria-checked={supplier === c.id}
                  onClick={() => setSupplier(c.id)}
                  className={`flex flex-col items-center gap-0.5 rounded-2xl border-2 p-2.5 ${supplier === c.id ? "border-lime bg-lime/10" : "border-line bg-surface-2"}`}
                >
                  <svg viewBox="0 0 40 30" width="40" height="30" aria-hidden="true">
                    <rect x="2" y="10" width="36" height="18" rx="2" fill={c.player ? "#a0522d" : "#8a8a84"} />
                    <path d="M2 16H38M2 22H38" stroke={c.player ? "#7a2e14" : "#5a5a56"} strokeWidth="2" />
                    {c.player ? (
                      <>
                        <circle cx="12" cy="8" r="5" fill="#c6f432" />
                        <circle cx="22" cy="7" r="5" fill="#e2542b" />
                        <circle cx="30" cy="9" r="4" fill="#c6f432" />
                      </>
                    ) : (
                      <rect x="10" y="3" width="20" height="8" rx="2" fill="#5a5a56" />
                    )}
                  </svg>
                  <span className="max-w-full truncate text-[13px] font-extrabold">{c.name}</span>
                  <span className="text-xs text-muted">{c.sub}</span>
                  <span className="text-xs font-bold">{naira(Math.round(c.price / Math.max(1, p.upl)))} a {p.unit}</span>
                </button>
              ))}
            </div>
          )}
          {p.supplyName && (
            <p className="-mt-1 text-xs text-muted">
              {p.inventoryLots > 0 ? `${p.inventoryLots.toFixed(1).replace(/\.0$/, "")} lots in stock. ` : ""}
              {lotsToBuy > 0 ? `Buying ${plural(lotsToBuy, "lot")} for ${naira(lotsToBuy * lotPrice)}.` : "Your stock covers today."}
            </p>
          )}

          <div className="flex items-center gap-2.5 rounded-[18px] bg-surface-2 p-2.5">
            <button type="button" aria-label={`One ${p.unit} fewer`} onClick={() => setUnits((u) => Math.max(0, u - 1))} className="h-12 w-12 rounded-full bg-line text-2xl font-extrabold">
              −
            </button>
            <div className="flex flex-1 flex-col items-center">
              <span className="h-display text-[26px] tabular-nums">{plural(units, supplierKind ? "lot" : p.unit)}</span>
              <span className="text-xs text-muted">
                Costs about {naira(goods)} · up to {p.capacity}
              </span>
            </div>
            <button type="button" aria-label={`One ${p.unit} more`} onClick={() => setUnits((u) => Math.min(p.capacity, u + 1))} className="h-12 w-12 rounded-full bg-lime text-2xl font-extrabold text-on-accent">
              +
            </button>
          </div>

          <div className="flex items-center gap-2.5 rounded-[18px] bg-surface-2 p-2.5">
            <button type="button" aria-label="Lower price" onClick={() => setPrice((v) => snap(v - step))} className="h-12 w-12 rounded-full bg-line text-2xl font-extrabold">
              −
            </button>
            <div className="flex flex-1 flex-col items-center gap-1">
              <span className="relative rounded-[6px_10px_10px_6px] bg-[#f2c230] py-1.5 pl-[22px] pr-3.5 font-display text-[22px] font-extrabold text-[#0e0e10]">
                {naira(price)}
                <span className="absolute left-[7px] top-1/2 -mt-[3.5px] h-[7px] w-[7px] rounded-full bg-surface-2" />
              </span>
              <span className="flex flex-wrap items-center justify-center gap-[3px]" aria-label={`About ${expected} customers expected`}>
                {Array.from({ length: Math.min(expected, 24) }, (_, i) => (
                  <span key={i} className="h-2 w-2 rounded-full bg-lime" aria-hidden="true" />
                ))}
                <span className="ml-1 text-xs text-muted">~{expected} customers</span>
              </span>
            </div>
            <button type="button" aria-label="Raise price" onClick={() => setPrice((v) => snap(v + step))} className="h-12 w-12 rounded-full bg-lime text-2xl font-extrabold text-on-accent">
              +
            </button>
          </div>
          <p className="-mt-1 text-center text-xs text-muted">
            {p.rivalLow !== null && p.rivalHigh !== null ? `Rivals charge ${naira(p.rivalLow)}–${naira(p.rivalHigh)}` : `No rivals open · usual ${naira(p.refPrice)}`} · Expected
            profit <strong className={profit >= 0 ? "text-lime-ink" : "text-pink-ink"}>{signedNaira(profit)}</strong>
          </p>

          {p.card && (
            <div className="flex flex-col gap-2">
              {!CARD_CHARACTER[p.card.slug ?? ""] && <p className="rounded-2xl border border-pink p-3 text-sm">{p.card.prompt}</p>}
              <div className="grid grid-cols-2 gap-2">
                {p.card.options.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={choice === i}
                    onClick={() => setChoice(i)}
                    className={`min-h-[46px] rounded-full px-3 text-sm font-extrabold ${choice === i ? "bg-pink text-on-accent" : "border border-line"} ${p.card!.options.length === 1 ? "col-span-2" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <FormError message={error} />
          <button type="button" className="btn-primary" onClick={roll} disabled={pending}>
            {pending ? "Rolling up…" : "Roll up the shutter"}
          </button>
        </div>
      )}

      {phase === "replay" && (
        <div className="flex flex-col items-center gap-2 px-5 pt-4 text-center" aria-live="polite">
          <span className="text-xs font-extrabold tracking-[0.1em] text-lime-ink">SHOP IS OPEN</span>
          <span className="h-display text-[22px]">{line}</span>
        </div>
      )}

      {played && (
        <div
          className={`hz-sheet fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] max-w-[480px] flex-col gap-3 overflow-y-auto rounded-t-[28px] border-t border-line bg-bg px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4 ${
            phase === "results" ? "translate-y-0" : "pointer-events-none translate-y-full"
          }`}
          aria-hidden={phase !== "results"}
        >
          <div className="h-1 w-10 self-center rounded-full bg-line" />
          <span className="text-xs font-extrabold tracking-[0.1em] text-muted">DAY {p.dayNo} SO FAR</span>
          <DayResults d={played.day} t={p.results} rating={played.rating} compact />
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              router.push("/hustle");
              router.refresh();
            }}
          >
            Back to my shop
          </button>
        </div>
      )}
    </div>
  );
}
