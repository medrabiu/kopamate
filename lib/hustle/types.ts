/** My Hustle shapes and constants shared by server and client code (no database access here). */

export type BusinessType = {
  slug: string;
  name: string;
  blurb: string;
  category: "food" | "services" | "supply";
  tier: "starter" | "growth";
  unit_name: string;
  kind: "consumer" | "supplier" | "b2b";
  sells_supply: boolean;
  perishable: boolean;
  slots: boolean;
  open_air: boolean;
  expiry_days: number | null;
  default_price: number;
  cost_per_unit: number;
  capacity_per_day: number;
  rent_per_day: number;
  upkeep_per_day: number;
  upkeep_provider_type: string | null;
  marketing_per_day: number;
  supply_type: string | null;
  units_per_supply_lot: number | null;
  setup_cost: number;
  townspeople_demand_per_day: number;
  price_floor_pct: number;
  price_ceiling_pct: number;
  need_key: string | null;
  need_days: number | null;
  is_active: boolean;
  sort: number;
};

export type Business = {
  id: string;
  owner_user_id: string;
  type_slug: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  state: string;
  stage: number;
  rating: number;
  rating_count: number;
  cash: number;
  status: "active" | "restructured" | "closed";
  hot_until: string | null;
  closed_through: string;
  restructures: number;
  trading_frozen: boolean;
  created_at: Date;
};

export type CardEffects = {
  cash?: number;
  rating?: number;
  demand?: number;
  price?: number;
  refund_units?: number;
  credit?: { units: number; due_days: number; repay_chance: number };
  buy_lots?: { lots: number; discount: number };
  modifiers?: { kind: "demand" | "capacity" | "daily_cost"; value: number; days: number; label: string }[];
  chance?: { p: number; then: CardEffects; else: CardEffects };
};

export type DecisionCard = {
  id: number;
  slug: string | null;
  applies_to_types: string[] | null;
  prompt: string;
  options: { label: string; effects: CardEffects }[];
  is_active: boolean;
};

export type DayPlan = { units: number; price: number; card: number | null; choice: number | null };

/** Logo icons a business can pick (drawn in components/hustle/BizArt.tsx). */
export const BIZ_ICONS = ["pot", "scissors", "shirt", "phone", "bolt", "leaf", "egg", "truck", "wrench", "star", "drop", "cart"] as const;
export type BizIcon = (typeof BIZ_ICONS)[number];

/** Logo colours (fills with dark text on them). */
export const BIZ_COLORS = ["#ff8a3d", "#c6f432", "#ff4fa3", "#7fc4ff", "#b9a6ff", "#ffd166", "#4ee6b0", "#ff6b6b"] as const;

export const CATEGORY_LABEL: Record<BusinessType["category"], string> = { food: "Food", services: "Services", supply: "Supply" };

/** Each type's default logo icon. */
export const TYPE_ICON: Record<string, BizIcon> = {
  buka: "pot",
  suya_spot: "bolt",
  provision_store: "cart",
  barber: "scissors",
  salon: "star",
  tailor: "shirt",
  laundry: "drop",
  cyber_cafe: "phone",
  pos_agent: "bolt",
  keke_rider: "truck",
  dispatch_rider: "truck",
  phone_repair: "phone",
  mechanic: "wrench",
  carpenter: "wrench",
  content_creator: "star",
  crop_farm: "leaf",
  poultry: "egg",
  fabric_trader: "shirt",
  cosmetics_supplier: "drop",
  phone_accessories: "phone",
};

/** "₦12,500", "−₦300". */
export function naira(n: number) {
  return (n < 0 ? "−₦" : "₦") + Math.abs(Math.round(n)).toLocaleString("en-NG");
}

/** "+₦1,380" / "−₦300". */
export function signedNaira(n: number) {
  return (n > 0 ? "+" : "") + naira(n);
}

export function initials(name: string) {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).toUpperCase() || "KB";
}
