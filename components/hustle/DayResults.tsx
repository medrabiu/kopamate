import type { DaySummary } from "@/lib/hustle/business";
import type { BusinessType } from "@/lib/hustle/types";
import { naira, signedNaira } from "@/lib/hustle/types";

function Line({ label, value, tone, strong }: { label: string; value: string; tone?: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "border-t border-line pt-2 font-bold" : ""}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${tone ?? ""}`}>{value}</span>
    </div>
  );
}

export type ResultsType = Pick<BusinessType, "unit_name" | "kind" | "perishable" | "slots" | "rent_per_day" | "upkeep_per_day" | "marketing_per_day">;

/**
 * A day's results: profit, customers, waste, the money lines and "What happened and why". The same component in
 * the text day page and the graphical replay's results card, so both modes always show the same numbers.
 */
export default function DayResults({ d, t, rating, compact = false }: { d: DaySummary; t: ResultsType; rating: number; compact?: boolean }) {
  const unit = (n: number) => `${n} ${t.unit_name}${n === 1 ? "" : "s"}`;
  const live = !d.closed;
  const sold = d.units_sold_town + d.units_sold_players;
  const tonight = t.rent_per_day + t.upkeep_per_day + t.marketing_per_day;
  // Before close, profit already counts tonight's rent and upkeep, so the number only moves with new sales.
  const profit = d.closed ? (d.profit ?? 0) : d.revenue - d.cost_of_goods + d.other - tonight;
  const turnedAway = Math.max(0, d.town_demand - d.units_sold_town);
  const headline = !d.opened
    ? "The shop stayed closed."
    : turnedAway >= 2
      ? `You sold out and turned away ${turnedAway}.`
      : d.units_wasted >= 2
        ? `${unit(d.units_wasted)} went to waste.`
        : live
          ? d.units_left > 0
            ? `${unit(d.units_left)} still on sale to players until midnight.`
            : "Sold out. Nice work."
          : "A steady day.";

  return (
    <div className="flex flex-col gap-4">
      <div className={`flex flex-col items-center gap-1 text-center ${compact ? "" : "py-3"}`}>
        <span className={`h-display leading-none tabular-nums ${compact ? "text-[40px]" : "text-[52px]"} ${profit >= 0 ? "text-lime-ink" : "text-pink-ink"}`}>{signedNaira(profit)}</span>
        <span className="text-[15px] text-muted">{headline}</span>
      </div>

      {d.opened && (
        <div className="grid grid-cols-3 gap-2.5">
          <div className="flex flex-col gap-0.5 rounded-2xl bg-surface-2 p-3">
            <span className="text-[11px] text-muted">{t.kind === "supplier" ? "Lots sold" : "Customers"}</span>
            <span className="text-lg font-bold tabular-nums">
              {sold} / {d.town_demand + d.units_sold_players}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-2xl bg-surface-2 p-3">
            <span className="text-[11px] text-muted">{live ? "Left now" : t.perishable && t.kind !== "supplier" ? "Wasted" : t.slots ? "Unbooked" : "Left over"}</span>
            <span className="text-lg font-bold tabular-nums">{live ? d.units_left : t.perishable ? d.units_wasted : Math.max(0, d.units_prepared - d.units_credit - sold)}</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-2xl bg-surface-2 p-3">
            <span className="text-[11px] text-muted">Rating</span>
            <span className="text-lg font-bold tabular-nums">★ {rating.toFixed(1)}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-[18px] bg-surface-2 p-4 text-sm">
        {d.opened && (
          <>
            <Line label={`Sales${d.price ? ` at ${naira(d.price)}` : ""}`} value={naira(d.revenue)} />
            <Line label={`Supplies & running costs (${unit(d.units_prepared)})`} value={`−${naira(d.cost_of_goods)}`} />
          </>
        )}
        {(d.closed || d.fixed_costs > 0) && <Line label="Rent & upkeep" value={`−${naira(d.fixed_costs)}`} />}
        {live && <Line label="Rent & upkeep (tonight)" value={`−${naira(tonight)}`} />}
        {d.other !== 0 && <Line label="Decision & credit" value={signedNaira(d.other)} />}
        <Line label={live ? "Profit if nothing else sells" : "Profit"} value={signedNaira(profit)} strong tone={profit >= 0 ? "text-lime-ink" : "text-pink-ink"} />
        {d.units_credit > 0 && d.price && <Line label="On credit (owed to you)" value={naira(d.units_credit * d.price)} tone="text-pink-ink" />}
      </div>

      {d.tips && d.tips.length > 0 && (
        <section className="flex flex-col gap-2.5 rounded-[18px] border border-lime p-4" aria-labelledby="why-title">
          <h2 id="why-title" className="text-xs font-bold tracking-[0.08em] text-lime-ink">
            WHAT HAPPENED AND WHY
          </h2>
          {d.tips.map((tip) => (
            <p key={tip.text} className="flex gap-2.5 text-sm leading-snug">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-lime" aria-hidden="true" />
              {tip.text}
            </p>
          ))}
        </section>
      )}
      {live && d.opened && <p className="text-center text-sm text-muted">Final results, with spoilage and rent, are ready tomorrow morning.</p>}
    </div>
  );
}
