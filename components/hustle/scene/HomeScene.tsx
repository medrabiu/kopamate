import Link from "next/link";
import { ChevronRight } from "@/components/icons";
import type { DaySummary } from "@/lib/hustle/business";
import { needText, type NeedStatus } from "@/lib/hustle/needs";
import type { Business, BusinessType } from "@/lib/hustle/types";
import { naira, signedNaira } from "@/lib/hustle/types";
import { lookFor, SKY, timeOfDay } from "./Person";
import ShopStage, { familyFor, type StageState } from "./ShopStage";

/** Small line icons for the need chips. */
export function NeedIcon({ need }: { need: string }) {
  const d: Record<string, string> = {
    food: "M3 12H21A9 9 0 0 1 3 12ZM8 9Q7 6 9 4M12 9Q11 6 13 4",
    grooming: "M8 16L19 4M16 16L5 4M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    laundry: "M4 4h16v16H4zM4 8h16M12 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    data: "M2 9Q12 0 22 9M5 13Q12 7 19 13M9 17Q12 15 15 17M12 20v.01",
    clothes: "M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z",
    printing: "M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z",
    rides: "M2 6h11v10H2zM13 10h4l3 3v3h-7M6 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01",
    cash: "M3 6h18v12H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  };
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d[need] ?? d.food} />
    </svg>
  );
}

/** "Prepare today's food", "Open today's slots"… */
function prepareLabel(t: Pick<BusinessType, "kind" | "slots" | "category" | "unit_name">) {
  if (t.kind === "supplier") return "Produce today's lots";
  if (t.category === "food") return "Prepare today's food";
  if (t.slots) return "Open today's slots";
  return `Prepare today's ${t.unit_name}s`;
}

type Props = {
  userId: string;
  business: Business;
  type: BusinessType;
  wallet: number;
  today: DaySummary | null;
  dayNo: number;
  vibe: number;
  needs: NeedStatus[];
};

/** My business, graphical: the shop scene on top, then the day's controls. Text cards follow on the page. */
export default function HomeScene({ userId, business: b, type: t, wallet, today, dayNo, vibe, needs }: Props) {
  const tod = timeOfDay();
  const state: StageState = !today?.opened ? "closed" : today.closed ? "done" : "open";
  const grooming = needs.find((n) => n.key === "grooming");
  const chips = [...needs].sort((a, c) => a.daysLeft - c.daysLeft).slice(0, 3);
  const soFar = today?.opened ? today.revenue - today.cost_of_goods + today.other - t.rent_per_day - t.upkeep_per_day - t.marketing_per_day : 0;
  const unit = (n: number) => `${n} ${t.kind === "supplier" ? "lot" : t.unit_name}${n === 1 ? "" : "s"}`;
  const label =
    state === "closed"
      ? `${b.name}, shutter down, preparing for the day.`
      : state === "open"
        ? `${b.name} is open with ${unit(today!.units_left)} on the counter.`
        : `${b.name} has closed for the day.`;

  return (
    <section className="-mx-5 flex flex-col gap-3" aria-label={`${b.name}, your shop`}>
      <div className="flex items-center gap-2 px-5">
        <span className="h-display min-w-0 flex-1 truncate text-xl">{b.name}</span>
        <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1.5 text-xs font-bold">Shop {naira(b.cash)}</span>
        <Link href="/hustle/wallet" className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1.5 text-xs font-bold">
          Wallet {naira(wallet)}
        </Link>
      </div>
      <ShopStage
        name={b.name}
        color={b.color}
        icon={b.icon}
        family={familyFor(t.slug)}
        sky={state === "done" ? SKY.evening : SKY[tod]}
        night={tod === "night"}
        state={state}
        owner={lookFor(userId)}
        hair={grooming?.state === "overdue" ? "messy" : "neat"}
        items={state === "open" ? today!.units_left : 0}
        steam={state === "open" && t.category === "food"}
        generator={state === "open"}
        label={label}
      />
      <div className="flex flex-col gap-3 px-5">
        <div className="flex items-center gap-2.5 text-[13px] text-muted">
          <span className="min-w-0 flex-1 truncate">
            Day {dayNo} · {t.name} · {b.state} · ★ {b.rating.toFixed(1)}
          </span>
          <span>
            Vibe <strong className={vibe >= 80 ? "text-lime-ink" : vibe >= 50 ? "text-ink" : "text-amber-ink"}>{vibe}%</strong>
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {chips.map((n) => (
            <Link
              key={n.key}
              href={`/hustle/market?need=${n.key}`}
              aria-label={`${n.label}: ${needText(n)}. Find it on the market street`}
              className={`flex min-h-12 items-center gap-2 rounded-[14px] border bg-surface-2 p-2.5 ${
                n.state === "overdue" ? "border-pink text-pink-ink" : n.state === "soon" ? "border-amber text-amber-ink" : "border-transparent text-lime-ink"
              }`}
            >
              <NeedIcon need={n.key} />
              <span className="min-w-0 text-xs font-bold leading-tight">
                <span className="block text-muted">{n.label}</span>
                {needText(n)}
              </span>
            </Link>
          ))}
        </div>
        {state === "closed" && (
          <Link href="/hustle/plan" className="btn-primary">
            {prepareLabel(t)}
          </Link>
        )}
        {state === "open" && (
          <Link href={`/hustle/day/${today!.day_date}`} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3.5">
            <span className="flex flex-col">
              <span className="text-xs font-bold tracking-[0.08em] text-lime-ink">SHOP IS OPEN</span>
              <span className="text-sm text-muted">{today!.units_left > 0 ? `${unit(today!.units_left)} on sale until midnight` : "Sold out for today"}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className={`h-display text-xl ${soFar >= 0 ? "text-lime-ink" : "text-pink-ink"}`}>{signedNaira(soFar)}</span>
              <ChevronRight size={18} className="text-muted" />
            </span>
          </Link>
        )}
        {state === "done" && (
          <Link href={`/hustle/day/${today!.day_date}`} className="flex items-center justify-between rounded-2xl bg-surface-2 p-3.5">
            <span className="text-sm text-muted">Day {dayNo} closed</span>
            <span className={`h-display text-xl ${(today!.profit ?? 0) >= 0 ? "text-lime-ink" : "text-pink-ink"}`}>{signedNaira(today!.profit ?? 0)}</span>
          </Link>
        )}
        <Link href="/hustle/market" className="btn-secondary">
          Walk to the market street
        </Link>
      </div>
    </section>
  );
}
