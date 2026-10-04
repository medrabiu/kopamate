/**
 * Everyone's needs, bought from player businesses in their state. Small needs hurt Vibe less when overdue.
 * Plain data, so client components can use it too (lib/hustle/needs.ts has the server side).
 */
export const NEEDS = [
  { key: "food", label: "Food", types: ["buka", "suya_spot", "provision_store"], days: 1, small: false },
  { key: "grooming", label: "Hair", types: ["barber", "salon"], days: 7, small: false },
  { key: "laundry", label: "Laundry", types: ["laundry"], days: 7, small: false },
  { key: "data", label: "Data", types: ["phone_repair"], days: 7, small: false },
  { key: "clothes", label: "Clothes", types: ["tailor"], days: 30, small: false },
  { key: "printing", label: "Printing", types: ["cyber_cafe"], days: 14, small: true },
  { key: "rides", label: "Rides", types: ["keke_rider"], days: 2, small: true },
  { key: "cash", label: "Cash", types: ["pos_agent"], days: 7, small: true },
] as const;

export type NeedKey = (typeof NEEDS)[number]["key"];
export const isNeed = (k: unknown): k is NeedKey => NEEDS.some((n) => n.key === k);
export const needFor = (k: string) => NEEDS.find((n) => n.key === k);

