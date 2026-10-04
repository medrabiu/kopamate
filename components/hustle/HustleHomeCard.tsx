import Link from "next/link";
import { ChevronRight, GiftIcon } from "@/components/icons";
import { sql } from "@/lib/db";
import { addDays } from "@/lib/hustle/data";
import { getNeeds, needText, urgentNeed } from "@/lib/hustle/needs";
import { naira, signedNaira } from "@/lib/hustle/types";
import { lagosDate } from "@/lib/util";
import { BizLogo } from "./BizArt";

type Row = {
  name: string;
  icon: string;
  color: string;
  stage: number;
  type_name: string;
  unit_name: string;
  opened: boolean | null;
  closed: boolean | null;
  profit: number | null;
  left: number | null;
  y_profit: number | null;
};

/** Home: My Hustle at a glance (or the call to start one), plus the Rewards link that left the bottom nav. */
export default async function HustleHomeCard({ userId, grant }: { userId: string; grant: number }) {
  const today = lagosDate();
  const [b] = await sql<Row[]>`
    SELECT b.name, b.icon, b.color, b.stage, t.name AS type_name, t.unit_name,
      d.opened_at IS NOT NULL AS opened, d.closed_at IS NOT NULL AS closed, d.profit::float8 AS profit, l.units_available AS "left",
      (SELECT profit::float8 FROM hustle_days WHERE business_id = b.id AND day_date = ${addDays(today, -1)}::date AND closed_at IS NOT NULL) AS y_profit
    FROM hustle_businesses b JOIN hustle_business_types t ON t.slug = b.type_slug
    LEFT JOIN hustle_days d ON d.business_id = b.id AND d.day_date = ${today}::date
    LEFT JOIN hustle_listings l ON l.business_id = b.id AND l.day_date = ${today}::date
    WHERE b.owner_user_id = ${userId}
  `;

  const rewards = (
    <Link href="/rewards" className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3">
      <GiftIcon size={20} className="text-lime-ink" />
      <span className="flex-1 text-[15px] font-bold">Rewards & prizes</span>
      <ChevronRight size={18} className="text-muted" />
    </Link>
  );

  if (!b) {
    return (
      <>
        <Link href="/hustle" className="card flex items-center gap-3" aria-label="Start your hustle">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs font-bold tracking-[0.08em] text-lime-ink">MY HUSTLE</span>
            <span className="h-display text-lg leading-tight">Start your hustle · {naira(grant)} startup money</span>
            <span className="text-sm text-muted">Run a buka, a barber, a farm… and trade with corpers in your state.</span>
          </div>
          <ChevronRight className="shrink-0 text-muted" />
        </Link>
        {rewards}
      </>
    );
  }

  const urgent = urgentNeed((await getNeeds(sql, userId)).needs);
  const status = b.closed && b.opened
    ? `Day closed · ${signedNaira(b.profit ?? 0)}`
    : b.opened
    ? (b.left ?? 0) > 0
      ? `Open · ${b.left} ${b.unit_name}${b.left === 1 ? "" : "s"} left`
      : "Open · sold out"
    : b.y_profit !== null
      ? `Shop closed · plan your day · yesterday ${signedNaira(b.y_profit)}`
      : "Shop closed · plan your day";
  return (
    <>
      <Link href="/hustle" className="card flex items-center gap-3 !p-4" aria-label={`My Hustle: ${b.name}`}>
        <BizLogo icon={b.icon} color={b.color} size={48} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-bold">{b.name}</span>
          <span className="truncate text-[13px] text-muted">
            {b.type_name} · Stage {b.stage}
          </span>
          <span className={`truncate text-[13px] font-bold ${b.opened ? "text-lime-ink" : "text-amber-ink"}`}>{status}</span>
          {urgent && (
            <span className={`truncate text-[13px] ${urgent.state === "overdue" ? "text-pink-ink" : "text-muted"}`}>
              {urgent.label} · {needText(urgent).toLowerCase()}
            </span>
          )}
        </div>
        <ChevronRight className="shrink-0 text-muted" />
      </Link>
      {rewards}
    </>
  );
}
