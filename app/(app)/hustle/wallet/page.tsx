import type { Metadata } from "next";
import HustleTabs from "@/components/hustle/HustleTabs";
import { sql, transaction } from "@/lib/db";
import { daysBetween, getBusinessByOwner } from "@/lib/hustle/data";
import { naira, signedNaira } from "@/lib/hustle/types";
import { ensureWallet, getWalletView } from "@/lib/hustle/wallet";
import { requireUser } from "@/lib/session";
import { lagosDate } from "@/lib/util";
import LiteToggle from "@/components/hustle/LiteToggle";
import { getHustleUiMode } from "@/lib/hustle/ui-mode";
import MoneyMover from "./MoneyMover";

export const metadata: Metadata = { title: "Wallet" };

function Bar({ value, tone }: { value: number; tone: "lime" | "amber" }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
      <div className={`h-full rounded-full ${tone === "lime" ? "bg-lime" : "bg-amber"}`} style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

export default async function WalletPage() {
  const user = await requireUser();
  const b = await getBusinessByOwner(sql, user.id);
  // Opening the wallet also pays this month's Allawee if it's due (the monthly cron does the same).
  if (b) await transaction((tx) => ensureWallet(tx, user.id));
  const [w, ui] = await Promise.all([getWalletView(user.id), getHustleUiMode(user)]);
  const today = lagosDate();
  const daysLeft = daysBetween(today, w.nextAllaweeOn);
  const monthDays = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate();

  return (
    <>
      <h1 className="h-display text-[28px]">Wallet</h1>
      <HustleTabs />

      <section className="card flex flex-col gap-1 !p-[18px]" aria-label="My wallet">
        <span className="text-[13px] text-muted">My wallet (personal money)</span>
        <span className="h-display text-[38px] leading-tight tabular-nums">{naira(w.balance)}</span>
        <span className="text-[13px] text-muted">
          {b ? `Business cash ${naira(b.cash)} is kept separate.` : "Start a business to get your startup money."}
        </span>
        <span className="text-xs font-bold text-faint">Game money · can&apos;t be withdrawn</span>
        {b && <MoneyMover wallet={w.balance} cash={b.cash} />}
      </section>

      <section className="card flex flex-col gap-2 !p-4" aria-label="Monthly Allawee">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-bold">Monthly Allawee</span>
          <span className="text-sm font-bold text-lime-ink">{naira(w.allawee)}</span>
        </div>
        <Bar value={1 - daysLeft / monthDays} tone="lime" />
        <span className="text-[13px] text-muted">
          Arrives in {daysLeft} {daysLeft === 1 ? "day" : "days"}, on the 1st
        </span>
      </section>

      <section className="card flex flex-col gap-2 !p-4" aria-label="Tasks today">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-bold">Tasks today</span>
          <span className="text-sm text-muted tabular-nums">
            {naira(w.taskToday)} of {naira(w.taskCap)}
          </span>
        </div>
        <Bar value={w.taskToday / Math.max(1, w.taskCap)} tone="amber" />
        <span className="text-[13px] text-muted">Daily Quiz ₦100, following a corper ₦20, a friend getting verified ₦200.</span>
      </section>

      {/* Only offered when everyone gets the graphical screens by default. */}
      {ui.liteToggle && <LiteToggle on={ui.lite} />}

      <section className="flex flex-col gap-2" aria-labelledby="recent-title">
        <h2 id="recent-title" className="h-display text-lg">
          Recent
        </h2>
        {w.recent.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {w.recent.map((r, i) => (
              <li key={i} className="flex justify-between gap-3 rounded-[14px] bg-surface-2 px-3.5 py-3 text-sm">
                <span className="min-w-0 truncate">{r.label}</span>
                <span className={`shrink-0 font-bold tabular-nums ${r.amount >= 0 ? "text-lime-ink" : "text-pink-ink"}`}>{signedNaira(r.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
