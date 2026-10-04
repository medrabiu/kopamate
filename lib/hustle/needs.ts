import "server-only";
import type { Db } from "./data";
import { hash32 } from "./engine";

export { isNeed, needFor, NEEDS, type NeedKey } from "./needs-meta";
import { NEEDS, type NeedKey } from "./needs-meta";

export type NeedStatus = {
  key: NeedKey;
  label: string;
  /** Days until it's due (negative: overdue by that many). */
  daysLeft: number;
  state: "ok" | "soon" | "overdue";
};

const DAY = 86400_000;

/** These come due in a new player's first 3 days, one per day, so there's something to buy straight away. */
const STAGGERED = ["grooming", "laundry", "data"] as const;

/**
 * When a need first comes due for a new player (before they've ever bought it), counted from wallet creation:
 * hair, laundry and data on days 1, 2 and 3 in an order picked from the user id (the same on every visit);
 * the rest after their full interval.
 */
export function firstDueDays(userId: string, key: string, days: number) {
  const i = STAGGERED.indexOf(key as (typeof STAGGERED)[number]);
  if (i < 0) return days;
  return ((i + hash32(userId)) % STAGGERED.length) + 1;
}

/**
 * Each need is satisfied until its last purchase + that seller's interval (e.g. salon lasts 10 days). Before
 * the first purchase, the clock starts when the wallet was created (see firstDueDays).
 */
export async function getNeeds(db: Db, userId: string, now = Date.now()): Promise<{ needs: NeedStatus[]; vibe: number }> {
  const [rows, [w]] = await Promise.all([
    db<{ need_key: string; until: Date }[]>`SELECT need_key, satisfied_until AS until FROM hustle_needs WHERE user_id = ${userId}`,
    db<{ created_at: Date }[]>`SELECT created_at FROM hustle_wallets WHERE user_id = ${userId}`,
  ]);
  const start = w?.created_at ? new Date(w.created_at).getTime() : now;
  const by = new Map(rows.map((r) => [r.need_key, new Date(r.until).getTime()]));
  let vibe = 100;
  const needs = NEEDS.map((n) => {
    const until = by.get(n.key) ?? start + firstDueDays(userId, n.key, n.days) * DAY;
    // Whole days, rounded up: 0.4 days left is "1 day left"; 0.4 days late is "1 day overdue".
    const daysLeft = until >= now ? Math.ceil((until - now) / DAY) : -Math.ceil((now - until) / DAY);
    if (daysLeft < 0) vibe -= (n.small ? 4 : 8) * Math.min(3, -daysLeft);
    // "Soon" is the last day or two, never straight after buying (rides last only 2 days).
    const soon = daysLeft <= Math.min(2, n.days - 1);
    return { key: n.key, label: n.label, daysLeft, state: daysLeft < 0 ? "overdue" : soon ? "soon" : "ok" } as NeedStatus;
  });
  return { needs, vibe: Math.max(0, Math.min(100, vibe)) };
}

export async function getVibe(db: Db, userId: string) {
  return (await getNeeds(db, userId)).vibe;
}

export function needText(n: NeedStatus) {
  if (n.daysLeft < 0) return `${-n.daysLeft === 1 ? "1 day" : `${-n.daysLeft} days`} overdue`;
  if (n.key === "food") return n.daysLeft >= 1 ? "Ate today" : "Eat today";
  if (n.daysLeft <= 1) return "1 day left";
  return `Due in ${n.daysLeft} days`;
}

/** The most urgent need, for Home ("Hair due in 2 days"). */
export function urgentNeed(needs: NeedStatus[]) {
  return [...needs].filter((n) => n.state !== "ok").sort((a, b) => a.daysLeft - b.daysLeft)[0] ?? null;
}
