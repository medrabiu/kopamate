import type { Metadata } from "next";
import Link from "next/link";
import { BackupButton } from "@/components/hustle/BuyButton";
import { BizLogo } from "@/components/hustle/BizArt";
import HustleTabs from "@/components/hustle/HustleTabs";
import { sql } from "@/lib/db";
import { availability, getMarket, MARKET_FILTERS } from "@/lib/hustle/market";
import { needFor } from "@/lib/hustle/needs";
import { backupPrice } from "@/lib/hustle/trade";
import { naira } from "@/lib/hustle/types";
import { timeOfDay } from "@/components/hustle/scene/Person";
import { familyFor } from "@/components/hustle/scene/ShopStage";
import type { StreetShop } from "@/components/hustle/scene/MarketStreet";
import { getBusinessByOwner, getTypes } from "@/lib/hustle/data";
import { offerFor } from "@/lib/hustle/offer";
import { getHustleUiMode } from "@/lib/hustle/ui-mode";
import { LazyMarketStreet } from "@/components/hustle/scene/lazy";
import { requireUser } from "@/lib/session";

import { stateFromSlug } from "@/lib/states";

export const metadata: Metadata = { title: "Market" };

const TONE = { lime: "text-lime-ink", amber: "text-amber-ink", muted: "text-muted" } as const;

export default async function MarketPage({ searchParams }: { searchParams: Promise<{ need?: string; state?: string; view?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const filter = MARKET_FILTERS.some((f) => f.key === sp.need) ? sp.need! : "all";
  // Other states can be browsed (from Corpers), but buying is only in your own state for now.
  const state = (sp.state && stateFromSlug(sp.state)) || user.state;
  if (!state) {
    return (
      <>
        <h1 className="h-display text-[28px]">Market</h1>
        <HustleTabs />
        <p className="card text-[15px] text-muted">Add your state in Profile to see businesses near you.</p>
      </>
    );
  }
  const own = state === user.state;
  const [rows, ui] = await Promise.all([getMarket(state, filter), getHustleUiMode(user)]);
  // The street, unless the player asked for the list (not offered in "graphical only").
  const street = ui.view === "graphical" && !(sp.view === "list" && ui.listView);
  const need = needFor(filter);
  const anyOpen = rows.some((r) => (r.left ?? 0) > 0 && r.owner_id !== user.id);
  const backup = own && need && !anyOpen ? await backupPrice(sql, need.key) : null;
  const q = (key: string) => `/hustle/market?${new URLSearchParams({ ...(key !== "all" ? { need: key } : {}), ...(own ? {} : { state: sp.state! }) })}`;

  if (street) {
    const [types, mine] = await Promise.all([getTypes(), getBusinessByOwner(sql, user.id)]);
    const byType = new Map(types.map((t) => [t.slug, t]));
    const myType = mine ? (byType.get(mine.type_slug) ?? null) : null;
    const shops: StreetShop[] = rows.slice(0, 20).map((r) => {
      const t = byType.get(r.type_slug)!;
      const isMine = r.owner_id === user.id;
      const { offer, why } = offerFor(t, myType, { isMine, sameState: own, viewerState: user.state, unitName: r.unit_name, slots: r.slots });
      const open = (r.left ?? 0) > 0;
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        color: r.color,
        icon: r.icon,
        family: familyFor(r.type_slug),
        typeName: r.type_name,
        owner: r.owner,
        rating: r.rating,
        mine: isMine,
        open,
        sold: Math.max(0, (r.prepared ?? 0) - (r.left ?? 0)),
        note: availability(r).text.replace(" today", ""),
        interior: r.type_slug === "barber" && !isMine,
        offer: r.listing_id !== null && r.price !== null ? { listingId: r.listing_id, item: offer.title, price: r.price, left: r.left ?? 0, cta: offer.cta, payNote: offer.payNote, multi: offer.multi } : null,
        why,
      };
    });
    const listParams = new URLSearchParams({ view: "list", ...(filter !== "all" ? { need: filter } : {}), ...(own ? {} : { state: sp.state! }) });
    return (
      <>
        <header className="flex flex-col gap-0.5">
          <h1 className="h-display text-[28px]">Market street</h1>
          {need && (
            <p className="text-sm text-muted">
              Shops that sort your {need.label.toLowerCase()} ·{" "}
              <Link href={own ? "/hustle/market" : `/hustle/market?state=${sp.state}`} className="font-bold text-lime-ink">
                Show all
              </Link>
            </p>
          )}
        </header>
        <HustleTabs />
        {backup && need && (
          <div className="card flex flex-col gap-2 !p-4">
            <p className="text-sm">
              Nobody in {state} sells {need.label.toLowerCase()} today. The backup shop always does, but it costs more and lasts {backup.days}{" "}
              {backup.days === 1 ? "day" : "days"}.
            </p>
            <BackupButton need={need.key} label={need.label} price={backup.price} />
          </div>
        )}
        <LazyMarketStreet state={state} shops={shops} listHref={ui.listView ? `/hustle/market?${listParams}` : null} sky={timeOfDay()} />
      </>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-0.5">
        <h1 className="h-display text-[28px]">Market</h1>
        <p className="text-sm text-muted">
          Businesses run by players in {state}
          {!own && " · you can buy in your own state"}
          {ui.view === "graphical" && (
            <>
              {" · "}
              <Link href={q(filter)} className="font-bold text-lime-ink">
                Street view
              </Link>
            </>
          )}
        </p>
      </header>
      <HustleTabs />
      <nav aria-label="Filter" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {MARKET_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={q(f.key)}
            aria-current={filter === f.key ? "page" : undefined}
            className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-bold ${filter === f.key ? "bg-lime text-on-accent" : "border border-line"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {backup && need && (
        <div className="card flex flex-col gap-2 !p-4">
          <p className="text-sm">
            Nobody in {state} sells {need.label.toLowerCase()} today. The backup shop always does, but it costs more and lasts {backup.days}{" "}
            {backup.days === 1 ? "day" : "days"}.
          </p>
          <BackupButton need={need.key} label={need.label} price={backup.price} />
        </div>
      )}

      {rows.length === 0 ? (
        <p className="card text-[15px] text-muted">
          No {filter === "all" ? "" : `${MARKET_FILTERS.find((f) => f.key === filter)!.label.toLowerCase()} `}businesses in {state} yet.{" "}
          {own && "Start one and you'll be the first."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((r) => {
            const a = availability(r);
            return (
              <li key={r.id}>
                <Link href={`/hustle/b/${r.slug}`} className="flex items-center gap-3 rounded-[18px] border border-line p-3.5">
                  <BizLogo icon={r.icon} color={r.color} size={48} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-bold">{r.name}</span>
                    <span className="truncate text-xs text-muted">
                      {r.type_name} · ★ {r.rating.toFixed(1)} · {r.owner_id === user.id ? "You" : r.owner}
                    </span>
                    <span className={`truncate text-xs ${TONE[a.tone]}`}>{a.text}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold">from {naira(r.price ?? r.default_price)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
