"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { openShop } from "@/app/actions/hustle";
import { FormError } from "@/components/forms";
import BuyButton from "@/components/hustle/BuyButton";
import { BizLogo } from "@/components/hustle/BizArt";
import { ChevronLeft } from "@/components/icons";
import { townCustomers } from "@/lib/hustle/engine";
import { naira, signedNaira } from "@/lib/hustle/types";

type P = {
  name: string;
  state: string;
  cash: number;
  dayNo: number;
  unit: string;
  kind: "consumer" | "supplier" | "b2b";
  perishable: boolean;
  slots: boolean;
  capacity: number;
  min: number;
  max: number;
  step: number;
  refPrice: number;
  base: number;
  rivalsWeight: number;
  rivalCount: number;
  rivalLow: number | null;
  rivalHigh: number | null;
  card: { id: number; prompt: string; options: string[] } | null;
  events: { headline: string; body: string }[];
  supplyName: string | null;
  inventoryLots: number;
  stockLotCost: number;
  suppliers: { listingId: number; name: string; slug: string; icon: string; color: string; rating: number; price: number; left: number }[];
  upl: number;
  normalLot: number;
  backupLot: number;
  running: number;
  fixed: number;
  salvagePct: number;
  modLabels: string[];
};

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const lots = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "border-t border-line pt-2 font-bold" : ""}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${tone ?? ""}`}>{value}</span>
    </div>
  );
}

export default function PlanForm({ p }: { p: P }) {
  const router = useRouter();
  const snap = (v: number) => Math.min(p.max, Math.max(p.min, Math.round(v / p.step) * p.step));
  const startPrice = snap(p.rivalLow && p.rivalHigh ? (p.rivalLow + p.rivalHigh) / 2 : p.refPrice);
  const [price, setPrice] = useState(startPrice);
  const [units, setUnits] = useState(() => Math.min(p.capacity, Math.round(townCustomers(p.base, p.refPrice, startPrice, p.rivalsWeight))));
  const [choice, setChoice] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const supplier = p.kind === "supplier";
  const upFront = supplier || p.perishable;
  const e = useMemo(() => {
    const expected = Math.round(townCustomers(p.base, p.refPrice, price, p.rivalsWeight));
    const sold = Math.min(expected, units);
    const lotsNeeded = p.upl ? units / p.upl : 0;
    const fromStock = Math.min(p.inventoryLots, lotsNeeded);
    const buyLots = p.upl ? Math.max(0, Math.ceil(lotsNeeded - p.inventoryLots - 1e-9)) : 0;
    const buyCost = buyLots * p.backupLot;
    const lotCost = (n: number) => n * (p.inventoryLots > 0 ? p.stockLotCost : p.backupLot);
    // Food that spoils pays for everything prepared; others use supplies only for what they sell.
    const goods = upFront
      ? (p.upl ? fromStock * p.stockLotCost + buyCost : 0) + units * p.running
      : (p.upl ? lotCost(sold / p.upl) : 0) + sold * p.running;
    const salvage = supplier ? Math.round((units - sold) * price * p.salvagePct) : 0;
    const sales = sold * price + salvage;
    return { expected, sold, buyLots, buyCost, fromStock, goods: Math.round(goods), sales, salvage, profit: Math.round(sales - goods - p.fixed) };
  }, [p, price, units, upFront, supplier]);

  const cashNeeded = upFront ? e.goods : e.buyCost;
  const short = cashNeeded > p.cash;

  function submit() {
    setError(undefined);
    start(async () => {
      const r = await openShop({ units, price, card: p.card?.id ?? null, choice });
      if ("error" in r) setError(r.error);
      else {
        router.push(`/hustle/day/${r.date}`);
        router.refresh();
      }
    });
  }

  let n = 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/hustle" aria-label="Back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex min-w-0 flex-col">
          <h1 className="h-display text-[22px] leading-tight">Plan day {p.dayNo}</h1>
          <span className="text-[13px] text-muted">Business cash {naira(p.cash)}</span>
        </div>
      </div>

      {(p.events.length > 0 || p.modLabels.length > 0) && (
        <div className="flex items-start gap-3 rounded-[18px] bg-surface-2 p-3.5">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="shrink-0 text-lime-ink">
            <path d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2h-1M7 9h7M7 13h7M7 16h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold tracking-[0.08em] text-lime-ink">MARKET NEWS · {p.state.toUpperCase()}</span>
            {p.events.map((ev) => (
              <span key={ev.headline} className="text-sm leading-snug">
                <strong>{ev.headline}.</strong> {ev.body}
              </span>
            ))}
            {p.modLabels.length > 0 && <span className="text-sm text-muted">This week: {p.modLabels.join(", ")}.</span>}
          </div>
        </div>
      )}

      {p.supplyName && (
        <section className="flex flex-col gap-2.5" aria-labelledby="supplies-title">
          <h2 id="supplies-title" className="h-display text-lg">
            {++n}. Supplies
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-0.5 rounded-[18px] border-2 border-line p-3">
              <span className="text-sm font-bold">In stock</span>
              <span className="text-xs text-muted">{p.supplyName}</span>
              <span className="text-[13px] font-bold">
                {lots(p.inventoryLots)} lots{p.inventoryLots > 0 ? ` · ${naira(p.stockLotCost)} each` : ""}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-[18px] border-2 border-line p-3">
              <span className="text-sm font-bold">Backup market</span>
              <span className="text-xs text-muted">Always available</span>
              <span className="text-[13px] font-bold">{naira(p.backupLot)} a lot</span>
            </div>
          </div>
          {p.suppliers.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {p.suppliers.map((s) => (
                <li key={s.listingId} className="flex items-center gap-3 rounded-[18px] border-2 border-lime/60 p-3">
                  <BizLogo icon={s.icon} color={s.color} size={36} />
                  <Link href={`/hustle/b/${s.slug}`} className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold">{s.name}</span>
                    <span className="text-xs text-muted">
                      Player · ★ {s.rating.toFixed(1)} · {naira(s.price)} a lot · {s.left} left
                    </span>
                  </Link>
                  <BuyButton listingId={s.listingId} shop={s.name} price={s.price} left={s.left} label="Order" multi payNote="From business cash." />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">No player in {p.state} is selling {p.supplyName?.toLowerCase()} supplies today, so the backup market fills the gap.</p>
          )}
          <p className="text-[13px] text-muted">
            One lot makes {plural(p.upl, p.unit)}. Stock is used first.{" "}
            {e.buyLots > 0 ? `You'll buy ${plural(e.buyLots, "lot")} from backup for ${naira(e.buyCost)}.` : "Your stock covers today."}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2.5" aria-labelledby="units-title">
        <h2 id="units-title" className="h-display text-lg">
          {++n}. {supplier ? "Lots to produce" : p.slots ? "Slots to offer" : `${p.unit[0].toUpperCase()}${p.unit.slice(1)}s to prepare`}
        </h2>
        <div className="flex flex-col gap-2 rounded-[18px] bg-surface-2 p-3.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="units" className="text-sm font-bold">
              {supplier ? "Lots" : p.slots ? "Slots" : `${p.unit[0].toUpperCase()}${p.unit.slice(1)}s`}
            </label>
            <span className="h-display text-[22px] tabular-nums">{units}</span>
          </div>
          <input id="units" type="range" min={0} max={p.capacity} step={1} value={units} onChange={(ev) => setUnits(Number(ev.target.value))} className="w-full accent-lime" />
          <span className="text-xs text-muted">
            {p.perishable && !supplier
              ? `Unsold food spoils tonight. You can make up to ${p.capacity} a day.`
              : supplier
                ? `Unsold lots go to middlemen at ${Math.round(p.salvagePct * 100)}% of your price. Up to ${p.capacity} a day.`
                : p.slots
                  ? `Unbooked slots cost nothing. Up to ${p.capacity} a day.`
                  : `Up to ${p.capacity} a day.`}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-2.5" aria-labelledby="price-title">
        <h2 id="price-title" className="h-display text-lg">
          {++n}. Set your price
        </h2>
        <div className="flex flex-col gap-2 rounded-[18px] bg-surface-2 p-3.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="price" className="text-sm font-bold">
              Price per {p.unit}
            </label>
            <span className="h-display text-[22px] tabular-nums">{naira(price)}</span>
          </div>
          <input id="price" type="range" min={p.min} max={p.max} step={p.step} value={price} onChange={(ev) => setPrice(Number(ev.target.value))} className="w-full accent-lime" />
          <div className="flex justify-between gap-3 text-[13px] text-muted">
            <span>
              About <strong className="text-ink">{plural(e.expected, supplier ? "lot" : "customer")}</strong> expected
            </span>
            <span className="text-right">
              {p.rivalLow !== null && p.rivalHigh !== null
                ? p.rivalLow === p.rivalHigh
                  ? `Rival charges ${naira(p.rivalLow)}`
                  : `Rivals ${naira(p.rivalLow)}–${naira(p.rivalHigh)}`
                : `No rivals open · usual ${naira(p.refPrice)}`}
            </span>
          </div>
        </div>
      </section>

      {p.card && (
        <section className="flex flex-col gap-2.5" aria-labelledby="card-title">
          <h2 id="card-title" className="h-display text-lg">
            {++n}. Today&apos;s decision
          </h2>
          <div className="flex flex-col gap-3 rounded-[18px] border border-pink p-4">
            <p className="text-[15px] leading-snug">{p.card.prompt}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {p.card.options.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={choice === i}
                  onClick={() => setChoice(i)}
                  className={`min-h-12 rounded-full px-3 text-sm font-bold ${choice === i ? "bg-pink text-on-accent" : "border border-line"} ${p.card!.options.length === 1 ? "col-span-2" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2 rounded-[18px] border border-line p-4 text-sm">
        <span className="text-xs font-bold tracking-[0.08em] text-muted">IF IT GOES AS EXPECTED</span>
        <Row label={`Sales (${e.sold} ${supplier ? "lots" : p.unit + (e.sold === 1 ? "" : "s")})`} value={naira(e.sales - e.salvage)} />
        {e.salvage > 0 && <Row label="Unsold to middlemen" value={naira(e.salvage)} />}
        <Row label={p.supplyName ? "Supplies & running costs" : "Running costs"} value={`−${naira(e.goods)}`} />
        <Row label="Rent & upkeep" value={`−${naira(p.fixed)}`} />
        <Row label="Profit" value={signedNaira(e.profit)} strong tone={e.profit >= 0 ? "text-lime-ink" : "text-pink-ink"} />
        <span className="text-xs text-faint">Not counting today&apos;s decision, or sales to players before midnight.</span>
      </div>

      {short && <FormError message={`That needs about ${naira(cashNeeded)} and you have ${naira(p.cash)}. Prepare fewer, or invest from your wallet.`} />}
      <FormError message={error} />
      <button type="button" className="btn-primary" onClick={submit} disabled={pending || (p.card !== null && choice === null)}>
        {pending ? "Opening…" : p.card && choice === null ? "Make today's decision" : "Open shop"}
      </button>
    </div>
  );
}
