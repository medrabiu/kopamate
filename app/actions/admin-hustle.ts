"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { sql, transaction } from "@/lib/db";
import { business, move, SYSTEM, wallet, type Pot } from "@/lib/hustle/ledger";
import { HUSTLE_SETTING_DEFAULTS } from "@/lib/hustle/settings";
import { grantPrize } from "@/lib/hustle/wallet";
import { isState } from "@/lib/states";
import { requireAdmin } from "@/lib/session";
import { getGlobalUiSetting } from "@/lib/hustle/ui-mode";
import { isUiSetting } from "@/lib/hustle/ui-rules";
import { track } from "@/lib/stats";

const text = (fd: FormData, name: string, max: number) => String(fd.get(name) ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const back = (tab: string, q: string) => redirect(`/admin/hustle?tab=${tab}&${q}`);

function changed() {
  revalidateTag("hustle");
  revalidatePath("/hustle", "layout");
  revalidatePath("/admin/hustle");
}

// ---------- Settings and the feature flag ----------

const NUMERIC = ["hustle_grant", "hustle_allawee", "hustle_task_cap", "hustle_town_multiplier", "hustle_backup_markup", "hustle_salvage_pct", "hustle_need_vibe_effect", "hustle_grace_days"];

export async function saveHustleSettings(fd: FormData) {
  const admin = await requireAdmin();
  const enabled = String(fd.get("hustle_enabled"));
  if (!["off", "admins", "all"].includes(enabled)) back("settings", "error=flag");
  const ui = String(fd.get("hustle_ui_mode"));
  if (!isUiSetting(ui)) back("settings", "error=flag");
  const before = await getGlobalUiSetting();
  const values: [string, string][] = [["hustle_enabled", enabled], ["hustle_ui_mode", ui]];
  for (const key of NUMERIC) {
    const raw = String(fd.get(key) ?? HUSTLE_SETTING_DEFAULTS[key]).trim();
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n < 0) back("settings", "error=number");
    values.push([key, raw]);
  }
  for (const [key, value] of values) {
    await sql`INSERT INTO settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
  // Display mode changes are logged in the events table (admin id, old and new mode).
  if (ui !== before) await track("hustle_ui_mode_changed", admin.id, { from: before, to: ui });
  changed();
  revalidatePath("/", "layout");
  back("settings", "saved=1");
}

// ---------- Business types ----------

const TYPE_INTS = [
  "default_price", "cost_per_unit", "capacity_per_day", "rent_per_day", "upkeep_per_day", "marketing_per_day", "setup_cost",
  "townspeople_demand_per_day", "units_per_supply_lot", "need_days", "expiry_days", "sort",
] as const;

export async function saveType(fd: FormData) {
  await requireAdmin();
  const slug = String(fd.get("slug") ?? "");
  const [t] = await sql`SELECT 1 FROM hustle_business_types WHERE slug = ${slug}`;
  if (!t) back("types", "error=type");
  const v: Record<string, number | null> = {};
  for (const k of TYPE_INTS) {
    const raw = String(fd.get(k) ?? "").trim();
    if (raw === "" && ["units_per_supply_lot", "need_days", "expiry_days"].includes(k)) {
      v[k] = null;
      continue;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) back("types", `error=number&edit=${slug}`);
    v[k] = n;
  }
  const floor = Number(fd.get("price_floor_pct"));
  const ceil = Number(fd.get("price_ceiling_pct"));
  if (!(floor > 0 && floor <= 1 && ceil >= 1 && ceil <= 5)) back("types", `error=bounds&edit=${slug}`);
  if (!v.default_price || !v.capacity_per_day) back("types", `error=number&edit=${slug}`);
  await sql`
    UPDATE hustle_business_types SET
      name = ${text(fd, "name", 40)}, blurb = ${text(fd, "blurb", 80)},
      default_price = ${v.default_price}, cost_per_unit = ${v.cost_per_unit}, capacity_per_day = ${v.capacity_per_day},
      rent_per_day = ${v.rent_per_day}, upkeep_per_day = ${v.upkeep_per_day}, marketing_per_day = ${v.marketing_per_day},
      setup_cost = ${v.setup_cost}, townspeople_demand_per_day = ${v.townspeople_demand_per_day},
      units_per_supply_lot = ${v.units_per_supply_lot}, need_days = ${v.need_days}, expiry_days = ${v.expiry_days}, sort = ${v.sort},
      price_floor_pct = ${floor}, price_ceiling_pct = ${ceil}, is_active = ${fd.get("is_active") === "on"}
    WHERE slug = ${slug}
  `;
  changed();
  back("types", "saved=1");
}

// ---------- Events ----------

/** Effects come from simple rows (target + percent), never raw JSON. */
function effectsFrom(fd: FormData) {
  const effects: { demand?: Record<string, number>; cost?: Record<string, number> } = {};
  for (const kind of ["demand", "cost"] as const) {
    for (let i = 0; i < 3; i++) {
      const target = String(fd.get(`${kind}_target_${i}`) ?? "").trim();
      const pct = Number(fd.get(`${kind}_pct_${i}`));
      if (!target || !Number.isFinite(pct) || pct === 0) continue;
      if (pct < -90 || pct > 300) continue;
      (effects[kind] ??= {})[target] = Math.round((1 + pct / 100) * 100) / 100;
    }
  }
  return effects;
}

export async function saveEvent(fd: FormData) {
  const admin = await requireAdmin();
  const headline = text(fd, "headline", 80);
  const body = text(fd, "body", 200);
  const starts = String(fd.get("starts_on") ?? "");
  const ends = String(fd.get("ends_on") ?? "");
  const state = String(fd.get("state") ?? "");
  if (!headline || !/^\d{4}-\d{2}-\d{2}$/.test(starts) || !/^\d{4}-\d{2}-\d{2}$/.test(ends) || ends < starts) back("events", "error=event");
  if (state && !isState(state)) back("events", "error=event");
  const effects = effectsFrom(fd);
  const id = String(fd.get("id") ?? "");
  if (/^\d+$/.test(id)) {
    await sql`
      UPDATE hustle_events SET headline = ${headline}, body = ${body}, starts_on = ${starts}, ends_on = ${ends},
        state = ${state || null}, effects = ${sql.json(effects)} WHERE id = ${id}
    `;
  } else {
    await sql`
      INSERT INTO hustle_events (starts_on, ends_on, state, headline, body, effects, created_by)
      VALUES (${starts}, ${ends}, ${state || null}, ${headline}, ${body}, ${sql.json(effects)}, ${admin.id})
    `;
  }
  changed();
  back("events", "saved=1");
}

export async function deleteEvent(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (/^\d+$/.test(id)) await sql`DELETE FROM hustle_events WHERE id = ${id}`;
  changed();
  back("events", "saved=1");
}

// ---------- Decision cards ----------

const EFFECT_KEYS = new Set(["cash", "rating", "demand", "price", "refund_units", "credit", "buy_lots", "modifiers", "chance"]);

function validEffects(e: unknown): boolean {
  if (!e || typeof e !== "object" || Array.isArray(e)) return false;
  return Object.entries(e as Record<string, unknown>).every(([k, v]) => {
    if (!EFFECT_KEYS.has(k)) return false;
    if (k === "chance") {
      const c = v as { p?: unknown; then?: unknown; else?: unknown };
      return typeof c?.p === "number" && c.p >= 0 && c.p <= 1 && validEffects(c.then) && validEffects(c.else);
    }
    return v !== null && v !== undefined;
  });
}

export async function saveCard(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const prompt = text(fd, "prompt", 200);
  const types = String(fd.get("applies_to_types") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const options: { label: string; effects: unknown }[] = [];
  for (let i = 0; i < 3; i++) {
    const label = text(fd, `label_${i}`, 40);
    if (!label) continue;
    let effects: unknown;
    try {
      effects = JSON.parse(String(fd.get(`effects_${i}`) || "{}"));
    } catch {
      back("cards", `error=json&edit=${id}`);
    }
    if (!validEffects(effects)) back("cards", `error=json&edit=${id}`);
    options.push({ label, effects });
  }
  if (!prompt || options.length === 0) back("cards", `error=card&edit=${id}`);
  const active = fd.get("is_active") === "on";
  if (/^\d+$/.test(id)) {
    await sql`
      UPDATE hustle_decision_cards SET prompt = ${prompt}, applies_to_types = ${types.length ? types : null},
        options = ${sql.json(options as never)}, is_active = ${active} WHERE id = ${id}
    `;
  } else {
    await sql`
      INSERT INTO hustle_decision_cards (prompt, applies_to_types, options, is_active)
      VALUES (${prompt}, ${types.length ? types : null}, ${sql.json(options as never)}, ${active})
    `;
  }
  changed();
  back("cards", "saved=1");
}

// ---------- Abuse tools ----------

export async function setFrozen(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("business_id") ?? "");
  await sql`UPDATE hustle_businesses SET trading_frozen = ${fd.get("frozen") === "1"} WHERE id = ${id}`;
  changed();
  back("abuse", "saved=1");
}

/** Undoes one ledger entry by moving the same amount back, as an admin_adjust entry with the reason. Once only. */
export async function reverseEntry(fd: FormData) {
  const admin = await requireAdmin();
  const id = String(fd.get("ledger_id") ?? "").trim();
  const reason = text(fd, "reason", 140);
  if (!/^\d+$/.test(id) || !reason) back("abuse", "error=reverse");
  const result = await transaction(async (tx) => {
    const [e] = await tx<{ from_kind: Pot["kind"]; from_id: string | null; to_kind: Pot["kind"]; to_id: string | null; amount: number }[]>`
      SELECT from_kind, from_id, to_kind, to_id, amount::float8 AS amount FROM hustle_ledger WHERE id = ${id} FOR UPDATE
    `;
    if (!e) return "missing";
    const [done] = await tx`SELECT 1 FROM hustle_ledger WHERE reason = 'admin_adjust' AND ref_id = ${`reverse:${id}`}`;
    if (done) return "done";
    const pot = (kind: Pot["kind"], pid: string | null): Pot => (kind === "wallet" ? wallet(pid!) : kind === "business" ? business(pid!) : SYSTEM);
    await move(tx, pot(e.to_kind, e.to_id), pot(e.from_kind, e.from_id), e.amount, "admin_adjust", {
      allowNegative: true,
      ref: `reverse:${id}`,
      source: admin.id,
      note: reason,
    });
    return "ok";
  });
  changed();
  back("abuse", result === "ok" ? "saved=1" : `error=${result}`);
}

/** Fresh start for a business: cash back to ₦10,000, stage 1, stock and effects cleared, trading on. */
export async function resetBusiness(fd: FormData) {
  const admin = await requireAdmin();
  const id = String(fd.get("business_id") ?? "");
  await transaction(async (tx) => {
    const [b] = await tx<{ cash: number }[]>`SELECT cash::float8 AS cash FROM hustle_businesses WHERE id = ${id} FOR UPDATE`;
    if (!b) return;
    const diff = 10_000 - b.cash;
    if (diff > 0) await move(tx, SYSTEM, business(id), diff, "admin_adjust", { source: admin.id, note: "reset" });
    if (diff < 0) await move(tx, business(id), SYSTEM, -diff, "admin_adjust", { source: admin.id, note: "reset" });
    await tx`UPDATE hustle_businesses SET stage = 1, status = 'active', trading_frozen = false, rating = 4.0 WHERE id = ${id}`;
    await tx`DELETE FROM hustle_inventory WHERE business_id = ${id}`;
    await tx`DELETE FROM hustle_modifiers WHERE business_id = ${id}`;
  });
  changed();
  back("abuse", "saved=1");
}

// ---------- Grants (contest prizes) ----------

export async function grantMoney(fd: FormData) {
  const admin = await requireAdmin();
  const who = text(fd, "username", 40).replace(/^@/, "");
  const amount = Number(fd.get("amount"));
  const note = text(fd, "note", 100);
  const to = String(fd.get("to")) === "business" ? "business" : "wallet";
  if (!who || !Number.isInteger(amount) || amount <= 0 || amount > 1_000_000 || !note) back("grant", "error=grant");
  const [u] = await sql<{ id: string }[]>`SELECT id FROM users WHERE lower(nickname) = lower(${who})`;
  if (!u) back("grant", "error=user");
  const ok = await transaction(async (tx) => {
    if (to === "business") {
      const [b] = await tx<{ id: string }[]>`SELECT id FROM hustle_businesses WHERE owner_user_id = ${u.id}`;
      if (!b) return false;
      await grantPrize(tx, { business: b.id }, amount, note, admin.id);
    } else {
      const [w] = await tx`SELECT 1 FROM hustle_wallets WHERE user_id = ${u.id}`;
      if (!w) return false;
      await grantPrize(tx, { wallet: u.id }, amount, note, admin.id);
    }
    await tx`
      INSERT INTO notifications (user_id, kind, title, body, url)
      VALUES (${u.id}, 'hustle', ${`You got a prize: ₦${amount.toLocaleString("en-NG")}`}, ${`${note} · game money`}, ${to === "business" ? "/hustle" : "/hustle/wallet"})
    `;
    return true;
  });
  changed();
  back("grant", ok ? "saved=1" : "error=nopot");
}
