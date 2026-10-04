import type { Metadata } from "next";
import Link from "next/link";
import {
  deleteEvent, grantMoney, resetBusiness, reverseEntry, saveCard, saveEvent, saveHustleSettings, saveType, setFrozen,
} from "@/app/actions/admin-hustle";
import { sql } from "@/lib/db";
import { abuseSignals, economy, ledgerFor } from "@/lib/hustle/admin";
import { getTypes } from "@/lib/hustle/data";
import { getHustleSettings } from "@/lib/hustle/settings";
import type { DecisionCard } from "@/lib/hustle/types";
import { naira } from "@/lib/hustle/types";
import { requireAdmin } from "@/lib/session";
import { STATES } from "@/lib/states";
import { lagosDate } from "@/lib/util";
import { btn, btnPrimary, input, panel } from "../ui";

export const metadata: Metadata = { title: "My Hustle" };

const TABS = [
  { key: "economy", label: "Economy" },
  { key: "types", label: "Business types" },
  { key: "events", label: "Events" },
  { key: "cards", label: "Decision cards" },
  { key: "settings", label: "Settings" },
  { key: "abuse", label: "Abuse" },
  { key: "grant", label: "Grant" },
] as const;

const ERRORS: Record<string, string> = {
  number: "Numbers must be whole and not negative. Nothing was saved.",
  bounds: "Price floor must be above 0 and at most 1; ceiling between 1 and 5. Nothing was saved.",
  flag: "Pick off, admins or all.",
  event: "An event needs a headline and valid dates (end on or after start).",
  json: "Effects must be valid JSON using the keys shown. Nothing was saved.",
  card: "A card needs a prompt and at least one option.",
  reverse: "Give a ledger id and a reason.",
  missing: "No ledger entry with that id.",
  done: "That entry was already reversed.",
  grant: "Grants need a username, a whole naira amount (up to ₦1,000,000) and a note.",
  user: "No user with that username.",
  nopot: "That user has no wallet or business yet.",
  type: "Unknown business type.",
};

/** Ready-made events from the spec, to fill the form in one click. */
const PRESETS = [
  { headline: "Salary week", body: "About 20% more people are eating out.", demand: [["food", 20]], cost: [] },
  { headline: "Fuel price up", body: "Keke and dispatch running costs are up 15%.", demand: [], cost: [["keke_rider", 15], ["dispatch_rider", 15]] },
] as const;

function Notice({ error, saved }: { error?: string; saved?: string }) {
  if (error && ERRORS[error]) return <p role="alert" className="rounded-lg border border-pink px-3 py-2 text-sm">{ERRORS[error]}</p>;
  if (saved) return <p role="status" className="rounded-lg border border-lime px-3 py-2 text-sm">Saved.</p>;
  return null;
}

async function Economy({ state }: { state: string | null }) {
  const e = await economy(state);
  const max = Math.max(1, ...e.days.map((d) => Math.max(d.money_in, d.money_out)));
  return (
    <>
      <form className="flex items-center gap-2 text-sm">
        <input type="hidden" name="tab" value="economy" />
        <select name="state" defaultValue={state ?? ""} className={input}>
          <option value="">Whole country</option>
          {STATES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className={btn}>Filter</button>
      </form>
      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["Money held by players", naira(e.totals.wallets + e.totals.cash)],
          ["In wallets / business cash", `${naira(e.totals.wallets)} / ${naira(e.totals.cash)}`],
          ["Players / businesses", `${e.totals.players} / ${e.totals.businesses}`],
          ["Businesses in the red", `${e.red.red} of ${e.red.total} (${e.red.total ? Math.round((100 * e.red.red) / e.red.total) : 0}%)`],
        ].map(([label, value]) => (
          <div key={label} className={panel}>
            <p className="text-xs text-muted">{label}</p>
            <p className="h-display text-xl">{value}</p>
          </div>
        ))}
      </section>
      <section className={panel}>
        <h2 className="h-display mb-1 text-lg">Last 14 days (Lagos)</h2>
        <p className="mb-3 text-xs text-muted">In: created by the game (grants, Allawee, tasks, prizes, townspeople…). Out: removed (rent, backup market, upkeep not paid to players…). Between: player to player.</p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr><th className="py-1">Day</th><th>In</th><th>Out</th><th>Between players</th><th className="w-1/3" /></tr>
          </thead>
          <tbody>
            {e.days.map((d) => (
              <tr key={d.day} className="border-t border-line">
                <td className="py-1.5">{d.day}</td>
                <td className="tabular-nums">{naira(d.money_in)}</td>
                <td className="tabular-nums">{naira(d.money_out)}</td>
                <td className="tabular-nums">{naira(d.between)}</td>
                <td>
                  <div className="flex flex-col gap-0.5" aria-hidden="true">
                    <div className="h-1.5 rounded bg-lime" style={{ width: `${(100 * d.money_in) / max}%` }} />
                    <div className="h-1.5 rounded bg-pink" style={{ width: `${(100 * d.money_out) / max}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="grid gap-3 md:grid-cols-2">
        <section className={panel}>
          <h2 className="h-display mb-2 text-lg">In and out by reason (14 days)</h2>
          <ul className="text-sm">
            {e.byReason.map((r) => (
              <li key={`${r.reason}-${r.dir}`} className="flex justify-between border-t border-line py-1">
                <span>{r.dir === "in" ? "In" : "Out"} · {r.reason}</span>
                <span className="tabular-nums">{naira(r.total)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={panel}>
          <h2 className="h-display mb-2 text-lg">Businesses by type and state</h2>
          <ul className="text-sm">
            {e.byType.map((r) => (
              <li key={`${r.type}-${r.state}`} className="flex justify-between border-t border-line py-1">
                <span>{r.type} · {r.state}</span>
                <span className="tabular-nums">{r.n}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

async function Types({ edit }: { edit?: string }) {
  const types = await getTypes();
  const F = ({ name, label, value }: { name: string; label: string; value: number | null }) => (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <input name={name} defaultValue={value ?? ""} inputMode="numeric" className={input} />
    </label>
  );
  return (
    <section className={panel}>
      <h2 className="h-display mb-1 text-lg">Business types</h2>
      <p className="mb-3 text-xs text-muted">Whole naira. Changes apply from each business&apos;s next day. Lot = a supply pack.</p>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr><th className="py-1">Type</th><th>Price</th><th>Cost/unit</th><th>Cap/day</th><th>Rent</th><th>Setup</th><th>Town ₦/day</th><th>Active</th><th /></tr>
        </thead>
        <tbody>
          {types.map((t) =>
            edit === t.slug ? (
              <tr key={t.slug} className="border-t border-line">
                <td colSpan={9} className="py-3">
                  <form action={saveType} className="flex flex-col gap-3">
                    <input type="hidden" name="slug" value={t.slug} />
                    <div className="grid gap-2 md:grid-cols-4">
                      <label className="flex flex-col gap-1 text-xs text-muted">Name<input name="name" defaultValue={t.name} className={input} /></label>
                      <label className="flex flex-col gap-1 text-xs text-muted md:col-span-3">Blurb<input name="blurb" defaultValue={t.blurb} className={input} /></label>
                      <F name="default_price" label="Default price" value={t.default_price} />
                      <F name="cost_per_unit" label="Cost per unit" value={t.cost_per_unit} />
                      <F name="capacity_per_day" label="Capacity per day" value={t.capacity_per_day} />
                      <F name="rent_per_day" label="Rent per day" value={t.rent_per_day} />
                      <F name="upkeep_per_day" label={`Upkeep per day → ${t.upkeep_provider_type ?? "backup"}`} value={t.upkeep_per_day} />
                      <F name="marketing_per_day" label="Marketing per day" value={t.marketing_per_day} />
                      <F name="setup_cost" label="Setup cost" value={t.setup_cost} />
                      <F name="townspeople_demand_per_day" label="Townspeople ₦/day per state" value={t.townspeople_demand_per_day} />
                      <F name="units_per_supply_lot" label={`Units per lot (${t.supply_type ?? "no supply"})`} value={t.units_per_supply_lot} />
                      <F name="need_days" label={`Need lasts days (${t.need_key ?? "none"})`} value={t.need_days} />
                      <F name="expiry_days" label="Lots expire after days" value={t.expiry_days} />
                      <F name="sort" label="Sort" value={t.sort} />
                      <label className="flex flex-col gap-1 text-xs text-muted">Price floor (× default)<input name="price_floor_pct" defaultValue={t.price_floor_pct} className={input} /></label>
                      <label className="flex flex-col gap-1 text-xs text-muted">Price ceiling (× default)<input name="price_ceiling_pct" defaultValue={t.price_ceiling_pct} className={input} /></label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={t.is_active} /> Active</label>
                    </div>
                    <div className="flex gap-2">
                      <button className={btnPrimary}>Save</button>
                      <Link href="/admin/hustle?tab=types" className={btn}>Cancel</Link>
                    </div>
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={t.slug} className="border-t border-line">
                <td className="py-1.5 font-bold">{t.name}</td>
                <td className="tabular-nums">{naira(t.default_price)}</td>
                <td className="tabular-nums">{naira(t.cost_per_unit)}</td>
                <td className="tabular-nums">{t.capacity_per_day}</td>
                <td className="tabular-nums">{naira(t.rent_per_day)}</td>
                <td className="tabular-nums">{naira(t.setup_cost)}</td>
                <td className="tabular-nums">{naira(t.townspeople_demand_per_day)}</td>
                <td>{t.is_active ? "Yes" : "No"}</td>
                <td><Link href={`/admin/hustle?tab=types&edit=${t.slug}`} className={btn}>Edit</Link></td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </section>
  );
}

type EventRow = { id: number; starts_on: string; ends_on: string; state: string | null; headline: string; body: string; effects: { demand?: Record<string, number>; cost?: Record<string, number> } };

function EffectRows({ kind, values, targets }: { kind: "demand" | "cost"; values: [string, number][]; targets: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{kind === "demand" ? "Demand change" : "Cost change"} (type or category, ± percent)</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-2">
          <select name={`${kind}_target_${i}`} defaultValue={values[i]?.[0] ?? ""} className={input}>
            <option value="">—</option>
            {targets.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input name={`${kind}_pct_${i}`} defaultValue={values[i] ? Math.round((values[i][1] - 1) * 100) : ""} placeholder="+20" className={`${input} w-24`} />
        </div>
      ))}
    </div>
  );
}

async function Events({ edit, preset }: { edit?: string; preset?: string }) {
  const [events, types] = await Promise.all([
    sql<EventRow[]>`SELECT id::int AS id, starts_on::text, ends_on::text, state, headline, body, effects FROM hustle_events ORDER BY starts_on DESC LIMIT 50`,
    getTypes(),
  ]);
  const targets = ["food", "services", "supply", ...types.map((t) => t.slug)];
  const p = preset !== undefined ? PRESETS[Number(preset)] : undefined;
  const current = events.find((e) => String(e.id) === edit);
  const today = lagosDate();
  const ev: EventRow = current ?? {
    id: 0,
    starts_on: today,
    ends_on: today,
    state: null,
    headline: p?.headline ?? "",
    body: p?.body ?? "",
    effects: {
      demand: p ? Object.fromEntries(p.demand.map(([k, v]) => [k, 1 + v / 100])) : undefined,
      cost: p ? Object.fromEntries(p.cost.map(([k, v]) => [k, 1 + v / 100])) : undefined,
    },
  };
  return (
    <>
      <section className={panel}>
        <h2 className="h-display mb-1 text-lg">{current ? "Edit event" : "New event"}</h2>
        <p className="mb-3 text-xs">
          Presets:{" "}
          {PRESETS.map((x, i) => (
            <Link key={x.headline} href={`/admin/hustle?tab=events&preset=${i}`} className="mr-2 font-bold text-lime-ink">{x.headline}</Link>
          ))}
        </p>
        <form action={saveEvent} className="flex flex-col gap-3" key={`${edit}-${preset}`}>
          {current && <input type="hidden" name="id" value={current.id} />}
          <div className="grid gap-2 md:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-muted md:col-span-2">Headline<input name="headline" defaultValue={ev.headline} required className={input} /></label>
            <label className="flex flex-col gap-1 text-xs text-muted">Starts<input type="date" name="starts_on" defaultValue={ev.starts_on} className={input} /></label>
            <label className="flex flex-col gap-1 text-xs text-muted">Ends<input type="date" name="ends_on" defaultValue={ev.ends_on} className={input} /></label>
            <label className="flex flex-col gap-1 text-xs text-muted md:col-span-3">Body<input name="body" defaultValue={ev.body} className={input} /></label>
            <label className="flex flex-col gap-1 text-xs text-muted">State
              <select name="state" defaultValue={ev.state ?? ""} className={input}>
                <option value="">All states</option>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <EffectRows kind="demand" values={Object.entries(ev.effects.demand ?? {})} targets={targets} />
            <EffectRows kind="cost" values={Object.entries(ev.effects.cost ?? {})} targets={targets} />
          </div>
          <button className={`${btnPrimary} self-start`}>Save event</button>
        </form>
      </section>
      <section className={panel}>
        <h2 className="h-display mb-2 text-lg">Scheduled</h2>
        <ul className="text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 border-t border-line py-2">
              <span>
                <strong>{e.headline}</strong> · {e.starts_on} to {e.ends_on} · {e.state ?? "All states"} ·{" "}
                <span className="text-muted">{JSON.stringify(e.effects)}</span>
              </span>
              <span className="flex shrink-0 gap-2">
                <Link href={`/admin/hustle?tab=events&edit=${e.id}`} className={btn}>Edit</Link>
                <form action={deleteEvent}><input type="hidden" name="id" value={e.id} /><button className={btn}>Delete</button></form>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

async function Cards({ edit }: { edit?: string }) {
  const cards = await sql<DecisionCard[]>`SELECT id::int AS id, slug, applies_to_types, prompt, options, is_active FROM hustle_decision_cards ORDER BY id`;
  const current = cards.find((c) => String(c.id) === edit);
  const blank = edit === "new";
  return (
    <>
      {(current || blank) && (
        <section className={panel}>
          <h2 className="h-display mb-1 text-lg">{current ? "Edit card" : "New card"}</h2>
          <p className="mb-3 text-xs text-muted">
            Effects keys: cash (₦, +/−), rating (±), demand (× today), price (× today), refund_units, credit {"{units, due_days, repay_chance}"}, buy_lots {"{lots, discount}"},
            modifiers [{"{kind: demand|capacity|daily_cost, value, days, label}"}], chance {"{p, then, else}"}. Write {"{unit}"} / {"{units}"} for the business&apos;s unit.
          </p>
          <form action={saveCard} className="flex flex-col gap-3">
            {current && <input type="hidden" name="id" value={current.id} />}
            <label className="flex flex-col gap-1 text-xs text-muted">Prompt<input name="prompt" defaultValue={current?.prompt} required className={input} /></label>
            <label className="flex flex-col gap-1 text-xs text-muted">Only for types (comma-separated slugs, empty = all)
              <input name="applies_to_types" defaultValue={current?.applies_to_types?.join(", ") ?? ""} className={input} />
            </label>
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid gap-2 md:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs text-muted">Option {i + 1} label<input name={`label_${i}`} defaultValue={current?.options[i]?.label ?? ""} className={input} /></label>
                <label className="flex flex-col gap-1 text-xs text-muted md:col-span-2">Effects (JSON)
                  <input name={`effects_${i}`} defaultValue={current?.options[i] ? JSON.stringify(current.options[i].effects) : "{}"} className={`${input} font-mono`} />
                </label>
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={current?.is_active ?? true} /> Active</label>
            <div className="flex gap-2">
              <button className={btnPrimary}>Save card</button>
              <Link href="/admin/hustle?tab=cards" className={btn}>Cancel</Link>
            </div>
          </form>
        </section>
      )}
      <section className={panel}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="h-display text-lg">Decision cards</h2>
          <Link href="/admin/hustle?tab=cards&edit=new" className={btn}>New card</Link>
        </div>
        <ul className="text-sm">
          {cards.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 border-t border-line py-2">
              <span className={c.is_active ? "" : "text-muted"}>
                <strong>{c.prompt}</strong> · {c.options.map((o) => o.label).join(" / ")} · {c.applies_to_types?.join(", ") ?? "all types"}
                {!c.is_active && " · off"}
              </span>
              <Link href={`/admin/hustle?tab=cards&edit=${c.id}`} className={btn}>Edit</Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

async function Settings() {
  const s = await getHustleSettings();
  const fields: [string, string, number][] = [
    ["hustle_grant", "Startup grant (₦)", s.grant],
    ["hustle_allawee", "Monthly Allawee (₦)", s.allawee],
    ["hustle_task_cap", "Task rewards cap per day (₦)", s.taskCap],
    ["hustle_town_multiplier", "Townspeople demand multiplier", s.townMultiplier],
    ["hustle_backup_markup", "Backup market markup (0.25 = +25%)", s.backupMarkup],
    ["hustle_salvage_pct", "Unsold lots to middlemen (0.7 = 70%)", s.salvagePct],
    ["hustle_need_vibe_effect", "Vibe effect on demand (0.05 = 5%)", s.needVibeEffect],
    ["hustle_grace_days", "Rent-free days when closed, for new businesses", s.graceDays],
  ];
  return (
    <section className={panel}>
      <h2 className="h-display mb-3 text-lg">Settings and feature flag</h2>
      <form action={saveHustleSettings} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-muted">
          My Hustle is open to
          <select name="hustle_enabled" defaultValue={s.enabled} className={input}>
            <option value="off">Nobody (off)</option>
            <option value="admins">Admins only (testing)</option>
            <option value="all">Everyone</option>
          </select>
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map(([key, label, value]) => (
            <label key={key} className="flex flex-col gap-1 text-sm text-muted">
              {label}
              <input name={key} defaultValue={value} className={input} />
            </label>
          ))}
        </div>
        <button className={`${btnPrimary} self-start`}>Save</button>
      </form>
    </section>
  );
}

async function Abuse({ who }: { who?: string }) {
  const [a, ledger] = await Promise.all([abuseSignals(), who ? ledgerFor(who) : Promise.resolve(null)]);
  const Freeze = ({ id, frozen }: { id: string; frozen: boolean }) => (
    <form action={setFrozen} className="inline">
      <input type="hidden" name="business_id" value={id} />
      <input type="hidden" name="frozen" value={frozen ? "0" : "1"} />
      <button className={btn}>{frozen ? "Unfreeze" : "Freeze trading"}</button>
    </form>
  );
  return (
    <>
      <section className={panel}>
        <h2 className="h-display mb-2 text-lg">Same buyer and seller, over 15 trades in 7 days</h2>
        {a.pairs.length === 0 ? <p className="text-sm text-muted">None.</p> : (
          <ul className="text-sm">{a.pairs.map((p) => (
            <li key={`${p.buyer_id}-${p.seller_id}`} className="flex items-center justify-between border-t border-line py-1.5">
              <span>{p.buyer} → {p.seller}: {p.n} trades, {naira(p.total)}</span><Freeze id={p.seller_id} frozen={false} />
            </li>
          ))}</ul>
        )}
      </section>
      <section className={panel}>
        <h2 className="h-display mb-2 text-lg">Over 60% of a seller&apos;s player sales from one buyer (7 days)</h2>
        {a.share.length === 0 ? <p className="text-sm text-muted">None.</p> : (
          <ul className="text-sm">{a.share.map((p) => (
            <li key={`${p.buyer}-${p.seller_id}`} className="flex items-center justify-between border-t border-line py-1.5">
              <span>{p.buyer} is {p.pct}% of {p.seller} ({naira(p.total)})</span><Freeze id={p.seller_id} frozen={false} />
            </li>
          ))}</ul>
        )}
      </section>
      <section className={panel}>
        <h2 className="h-display mb-2 text-lg">Over ₦20,000 from players, invests or prizes in 24 hours</h2>
        {a.jumps.length === 0 ? <p className="text-sm text-muted">None.</p> : (
          <ul className="text-sm">{a.jumps.map((j) => (
            <li key={j.id} className="flex items-center justify-between border-t border-line py-1.5">
              <span>{j.name} ({j.owner}): +{naira(j.gained)}</span><Freeze id={j.id} frozen={j.frozen} />
            </li>
          ))}</ul>
        )}
      </section>
      <section className={panel}>
        <h2 className="h-display mb-2 text-lg">Restructured or frozen</h2>
        {a.restructures.length === 0 ? <p className="text-sm text-muted">None.</p> : (
          <ul className="text-sm">{a.restructures.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 border-t border-line py-1.5">
              <span>{r.name} ({r.owner}): {r.restructures} restructures, cash {naira(r.cash)}</span>
              <span className="flex gap-2">
                <Freeze id={r.id} frozen={r.frozen} />
                <form action={resetBusiness}><input type="hidden" name="business_id" value={r.id} /><button className={btn}>Reset</button></form>
              </span>
            </li>
          ))}</ul>
        )}
      </section>
      <section className={panel}>
        <h2 className="h-display mb-2 text-lg">Ledger and reversals</h2>
        <form className="mb-3 flex gap-2">
          <input type="hidden" name="tab" value="abuse" />
          <input name="who" defaultValue={who} placeholder="username" className={input} />
          <button className={btn}>Show ledger</button>
        </form>
        <form action={reverseEntry} className="mb-3 flex flex-wrap gap-2">
          <input name="ledger_id" placeholder="Ledger id" className={`${input} w-28`} />
          <input name="reason" placeholder="Reason (logged)" className={`${input} flex-1`} />
          <button className={btn}>Reverse entry</button>
        </form>
        {who && !ledger && <p className="text-sm text-muted">No user called {who}.</p>}
        {ledger && (
          <>
            {ledger.business && (
              <div className="mb-2 flex items-center gap-2 text-sm">
                Business: <strong>{ledger.business.name}</strong> <Freeze id={ledger.business.id} frozen={ledger.business.frozen} />
                <form action={resetBusiness}><input type="hidden" name="business_id" value={ledger.business.id} /><button className={btn}>Reset business</button></form>
              </div>
            )}
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted"><tr><th>Id</th><th>When</th><th>Reason</th><th>Flow</th><th>Amount</th><th>Note</th></tr></thead>
              <tbody>{ledger.rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-1 tabular-nums">{r.id}</td>
                  <td>{new Date(r.at).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{r.reason}</td>
                  <td className="text-muted">{r.from_kind} → {r.to_kind}</td>
                  <td className={`tabular-nums ${r.incoming ? "text-lime-ink" : "text-pink-ink"}`}>{r.incoming ? "+" : "−"}{naira(r.amount)}</td>
                  <td className="text-muted">{r.note}</td>
                </tr>
              ))}</tbody>
            </table>
          </>
        )}
      </section>
    </>
  );
}

function Grant() {
  return (
    <section className={panel}>
      <h2 className="h-display mb-1 text-lg">Grant game money</h2>
      <p className="mb-3 text-xs text-muted">For contest prizes. Uncapped, logged in the ledger with your id, and the player is notified.</p>
      <form action={grantMoney} className="grid gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm text-muted">Username<input name="username" required className={input} /></label>
        <label className="flex flex-col gap-1 text-sm text-muted">Amount (₦)<input name="amount" inputMode="numeric" required className={input} /></label>
        <label className="flex flex-col gap-1 text-sm text-muted">To
          <select name="to" className={input}><option value="wallet">Wallet</option><option value="business">Business cash</option></select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">Note (shown to them)<input name="note" required maxLength={100} placeholder="Quiz contest winner" className={input} /></label>
        <button className={`${btnPrimary} self-start`}>Grant</button>
      </form>
    </section>
  );
}

export default async function AdminHustlePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "economy";
  const state = sp.state && (STATES as readonly string[]).includes(sp.state) ? sp.state : null;
  return (
    <>
      <nav aria-label="My Hustle admin" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/hustle?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold ${tab === t.key ? "bg-surface-2 text-ink" : "text-muted"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Notice error={sp.error} saved={sp.saved} />
      {tab === "economy" && <Economy state={state} />}
      {tab === "types" && <Types edit={sp.edit} />}
      {tab === "events" && <Events edit={sp.edit} preset={sp.preset} />}
      {tab === "cards" && <Cards edit={sp.edit} />}
      {tab === "settings" && <Settings />}
      {tab === "abuse" && <Abuse who={sp.who} />}
      {tab === "grant" && <Grant />}
    </>
  );
}
