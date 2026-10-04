import Link from "next/link";
import { BizLogo, Shopfront } from "@/components/hustle/BizArt";
import HustleTabs from "@/components/hustle/HustleTabs";
import { ChevronRight } from "@/components/icons";
import { sql } from "@/lib/db";
import { getDay, getPartners, getProfitSummary } from "@/lib/hustle/business";
import { activeEvents, addDays, dayNumber, getBusinessByOwner, getType } from "@/lib/hustle/data";
import { catchUp } from "@/lib/hustle/day";
import { getBoard, getRegulars } from "@/lib/hustle/market";
import { getNeeds, needText } from "@/lib/hustle/needs";
import { getHustleSettings } from "@/lib/hustle/settings";
import { naira, signedNaira } from "@/lib/hustle/types";
import HomeScene from "@/components/hustle/scene/HomeScene";
import { getHustleUiMode } from "@/lib/hustle/ui-mode";
import { requireUser } from "@/lib/session";
import { lagosDate } from "@/lib/util";

function Intro({ grant, hasState }: { grant: number; hasState: boolean }) {
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="h-display text-[28px]">My Hustle</h1>
        <p className="text-[15px] text-muted">Run a small business in your state, with game money.</p>
      </header>
      <HustleTabs />
      <section className="card flex flex-col gap-4 !p-[22px]" aria-labelledby="start-title">
        <p className="text-xs font-bold tracking-[0.08em] text-lime-ink">START YOUR HUSTLE</p>
        <h2 id="start-title" className="h-display text-2xl leading-tight">
          {naira(grant)} startup money
        </h2>
        <ol className="flex flex-col gap-2 text-[15px]">
          <li>1. Pick a business: a buka, a barber, a farm and more.</li>
          <li>2. Each day, plan how much to prepare and your price, then open.</li>
          <li>3. Sell to townspeople and other players, and buy what you need from them.</li>
        </ol>
        <p className="text-[13px] text-faint">Game money only. It can&apos;t be withdrawn, bought or sold.</p>
        {hasState ? (
          <Link href="/hustle/start" className="btn-primary">
            Start your hustle
          </Link>
        ) : (
          <Link href="/profile/settings" className="btn-secondary">
            Add your state first
          </Link>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-surface-2 p-3">
      <span className="text-[11px] text-muted">{label}</span>
      <span className={`text-base font-bold tabular-nums ${tone === "good" ? "text-lime-ink" : tone === "bad" ? "text-pink-ink" : ""}`}>{value}</span>
    </div>
  );
}

const tone = (n: number | null) => (n === null ? undefined : n >= 0 ? "good" : "bad");

export default async function HustlePage() {
  const user = await requireUser();
  const mine = await getBusinessByOwner(sql, user.id);
  if (!mine) {
    const s = await getHustleSettings();
    return (
      <Intro grant={s.grant} hasState={Boolean(user.state)} />
    );
  }
  await catchUp(mine.id);
  const today = lagosDate();
  const [b, [wallet]] = await Promise.all([
    getBusinessByOwner(sql, user.id),
    sql<{ balance: number }[]>`SELECT balance::float8 AS balance FROM hustle_wallets WHERE user_id = ${user.id}`,
  ]);
  const [t, todayDay, lastDay, profits, events, partners, regulars, { needs, vibe }, board] = await Promise.all([
    getType(sql, b!.type_slug),
    getDay(sql, b!.id, today),
    getDay(sql, b!.id, addDays(today, -1)),
    getProfitSummary(b!.id, today),
    activeEvents(sql, b!.state, today),
    getPartners(b!.id),
    getRegulars(b!.id),
    getNeeds(sql, user.id),
    getBoard(b!.state, null),
  ]);
  const rank = board.find((r) => r.id === b!.id)?.rank;
  const biz = b!;
  const type = t!;
  const opened = Boolean(todayDay?.opened);
  const graphical = (await getHustleUiMode(user)).view === "graphical";

  return (
    <>
      <div className="flex items-center justify-between text-[13px] text-muted">
        <span className="font-bold tracking-[0.08em]">MY HUSTLE · DAY {dayNumber(biz, today)}</span>
        <Link href="/hustle/leaderboard" className="flex items-center gap-1">
          {biz.status === "restructured" && <span className="text-amber-ink">Restructured · </span>}
          {biz.state} board{rank ? <strong className="text-lime-ink"> #{rank}</strong> : ""}
          <ChevronRight size={14} />
        </Link>
      </div>
      <HustleTabs />

      {graphical ? (
        <HomeScene
          userId={user.id}
          business={biz}
          type={type}
          wallet={wallet?.balance ?? 0}
          today={todayDay}
          dayNo={dayNumber(biz, today)}
          vibe={vibe}
          needs={needs}
        />
      ) : (
        <>
        <section className="card overflow-hidden !p-0" aria-label={biz.name}>
          <Shopfront color={biz.color} category={type.category} />
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div className="flex items-end gap-3">
              <div className="relative -mt-7 shrink-0">
                <BizLogo icon={biz.icon} color={biz.color} size={60} ring />
              </div>
              <div className="min-w-0 pt-2">
                <h1 className="h-display truncate text-[22px] leading-tight">{biz.name}</h1>
                <p className="truncate text-[13px] text-muted">
                  {type.name} · {biz.state} · Stage {biz.stage} · ★ {biz.rating.toFixed(1)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-0.5 rounded-2xl bg-surface-2 p-3">
                <span className="text-xs text-muted">Business cash</span>
                <span className={`h-display text-[22px] tabular-nums ${biz.cash < 0 ? "text-pink-ink" : ""}`}>{naira(biz.cash)}</span>
              </div>
              <Link href="/hustle/wallet" className="flex flex-col gap-0.5 rounded-2xl bg-surface-2 p-3">
                <span className="text-xs text-muted">My wallet</span>
                <span className="h-display text-[22px] tabular-nums">{naira(wallet?.balance ?? 0)}</span>
              </Link>
            </div>
          </div>
        </section>

        {!opened ? (
          <section className="flex flex-col gap-3 rounded-3xl bg-lime p-[18px] text-on-accent" aria-labelledby="today-title">
            <div className="flex flex-col gap-1">
              <h2 id="today-title" className="text-xs font-bold tracking-[0.08em]">
                SHOP CLOSED · PLAN YOUR DAY
              </h2>
              <p className="text-[15px] leading-snug">
                {events[0] ? `${events[0].headline}. ` : ""}
                {type.kind === "supplier"
                  ? "Decide how many lots to produce, set your price and open."
                  : type.supply_type
                    ? "Buy supplies, set your price and open."
                    : "Set how many you can serve, your price, and open."}
              </p>
            </div>
            <Link href="/hustle/plan" className="flex h-[52px] items-center justify-center rounded-full bg-on-accent text-base font-bold text-lime">
              Plan today
            </Link>
          </section>
        ) : todayDay!.closed ? (
          <Link href={`/hustle/day/${today}`} className="card flex items-center justify-between gap-3" aria-label="Today's results">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-[0.08em] text-muted">DAY {dayNumber(biz, today)} CLOSED</span>
              <span className={`h-display text-2xl ${(todayDay!.profit ?? 0) < 0 ? "text-pink-ink" : "text-lime-ink"}`}>{signedNaira(todayDay!.profit ?? 0)} profit</span>
              <span className="text-sm text-muted">Your next business day opens tomorrow morning.</span>
            </div>
            <ChevronRight className="shrink-0 text-muted" />
          </Link>
        ) : (
          <Link href={`/hustle/day/${today}`} className="card flex items-center justify-between gap-3" aria-label="Today's results">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-[0.08em] text-lime-ink">OPEN · DAY {dayNumber(biz, today)}</span>
              <span className="h-display text-xl">
                {signedNaira(todayDay!.revenue - todayDay!.cost_of_goods + todayDay!.other - type.rent_per_day - type.upkeep_per_day - type.marketing_per_day)} so far
              </span>
              <span className="text-sm text-muted">
                {todayDay!.units_left > 0
                  ? `${todayDay!.units_left} ${type.unit_name}${todayDay!.units_left === 1 ? "" : "s"} still on sale to players until midnight`
                  : "Sold out for today. Plan again tomorrow."}
              </span>
            </div>
            <ChevronRight className="shrink-0 text-muted" />
          </Link>
        )}
        </>
      )}

      {lastDay?.closed && (
        <Link href={`/hustle/day/${lastDay.day_date}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3">
          <span className="text-sm text-muted">
            Yesterday{lastDay.opened ? "" : " (closed all day)"}:{" "}
            <strong className={lastDay.profit !== null && lastDay.profit < 0 ? "text-pink-ink" : "text-lime-ink"}>{signedNaira(lastDay.profit ?? 0)}</strong>
          </span>
          <span className="text-sm font-bold text-lime-ink">See why</span>
        </Link>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Yesterday" value={profits.yesterday === null ? "–" : signedNaira(profits.yesterday)} tone={tone(profits.yesterday)} />
        <Stat label="Last 7 days" value={profits.week === null ? "–" : signedNaira(profits.week)} tone={tone(profits.week)} />
        <Stat label="Regulars" value={`${regulars} ${regulars === 1 ? "player" : "players"}`} />
      </div>
      {profits.receivable > 0 && <p className="-mt-2 text-[13px] text-muted">Owed to you on credit: {naira(profits.receivable)}</p>}

      <section className="flex flex-col gap-2.5" aria-labelledby="needs-title">
        <div className="flex items-baseline justify-between">
          <h2 id="needs-title" className="h-display text-[19px]">
            My needs
          </h2>
          <span className="text-[13px] text-muted">Vibe {vibe}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line" role="meter" aria-label="Vibe" aria-valuenow={vibe} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full ${vibe >= 50 ? "bg-lime" : vibe >= 30 ? "bg-amber" : "bg-pink"}`} style={{ width: `${vibe}%` }} />
        </div>
        <p className="text-xs text-faint">
          {vibe >= 80 ? "High Vibe: 5% more customers for your business." : vibe < 50 ? "Low Vibe costs you customers. Sort your needs in the Market." : "Keep your needs sorted to keep your Vibe up."}
        </p>
        <div className="grid grid-cols-3 gap-2.5">
          {needs.map((n) => (
            <Link
              key={n.key}
              href={`/hustle/market?need=${n.key}`}
              className={`flex flex-col gap-1 rounded-2xl border p-3 ${n.state === "overdue" ? "border-pink" : n.state === "soon" ? "border-amber" : "border-transparent bg-surface-2"}`}
            >
              <span className="text-xs text-muted">{n.label}</span>
              <span className={`text-sm font-bold leading-tight ${n.state === "overdue" ? "text-pink-ink" : n.state === "soon" ? "text-amber-ink" : "text-lime-ink"}`}>
                {needText(n)}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {partners.length > 0 && (
        <section className="flex flex-col gap-2.5" aria-labelledby="partners-title">
          <h2 id="partners-title" className="h-display text-[19px]">
            Who I work with
          </h2>
          <ul className="card flex flex-col !p-0">
            {partners.map((p) => (
              <li key={p.id} className="border-b border-line last:border-b-0">
                <Link href={`/hustle/b/${p.slug}`} className="flex items-center gap-3 px-4 py-3">
                  <BizLogo icon={p.icon} color={p.color} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{p.name}</span>
                    <span className="block truncate text-xs text-muted">{p.type_name}</span>
                  </span>
                  <span className="text-xs text-muted">{p.role}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
