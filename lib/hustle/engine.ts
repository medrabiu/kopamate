/**
 * My Hustle: the maths of a business day, with no database access (lib/hustle/day.ts does the reads and writes).
 * Everything random is seeded by the business and the Lagos date, so refreshing can never change an outcome.
 */

/** 32-bit FNV-1a hash of a string. */
export function hash32(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A number in [0, 1) that is always the same for the same business, date and purpose. */
export function seeded(businessId: string, date: string, purpose: string) {
  // mulberry32 step over the hash, so nearby seeds still spread evenly.
  let t = (hash32(`${businessId}|${date}|${purpose}`) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** How much a price pulls customers compared with the reference price. */
export const PRICE_EXPONENT = 1.6;
export const priceWeight = (refPrice: number, price: number) => Math.pow(refPrice / price, PRICE_EXPONENT);

/** Demand factor from the star rating: 0.8 at ★3, 1.0 at ★4, 1.15 at ★5, in straight lines between. */
export function ratingFactor(rating: number) {
  const r = Math.min(5, Math.max(1, rating));
  if (r >= 4) return 1 + (r - 4) * 0.15;
  if (r >= 3) return 0.8 + (r - 3) * 0.2;
  return 0.8 - (3 - r) * 0.1; // ★1 = 0.6
}

/** Owner's Vibe (0-100) to a demand factor; `effect` is the hustle_need_vibe_effect setting (0.05). */
export function vibeFactor(vibe: number, effect: number) {
  if (vibe >= 80) return 1 + effect;
  if (vibe < 30) return 1 - effect * 2;
  if (vibe < 50) return 1 - effect;
  return 1;
}

export const priceBounds = (t: { default_price: number; price_floor_pct: number; price_ceiling_pct: number }) => ({
  min: Math.ceil(t.default_price * Number(t.price_floor_pct)),
  max: Math.floor(t.default_price * Number(t.price_ceiling_pct)),
});

/** A friendly slider step for a price range. */
export function priceStep(defaultPrice: number) {
  if (defaultPrice >= 4000) return 250;
  if (defaultPrice >= 1000) return 50;
  if (defaultPrice >= 300) return 10;
  return 5;
}

/**
 * Customers a business gets from town at `price`: the town's customers at the reference price (`base`),
 * shared by price attractiveness with rivals (`rivalsWeight` = sum of their weights). Alone or with
 * expensive rivals the total shrinks, so a high price always costs customers.
 */
export function townCustomers(base: number, refPrice: number, price: number, rivalsWeight: number) {
  const w = priceWeight(refPrice, price);
  return (base * w) / Math.max(1, rivalsWeight + w);
}

/** ±10% seeded noise, rounded to whole customers. */
export function withNoise(customers: number, businessId: string, date: string) {
  const n = 0.9 + seeded(businessId, date, "demand") * 0.2;
  return Math.max(0, Math.round(customers * n));
}

export type Tip = { text: string };

export type TipInput = {
  unit: string;
  units: number;
  capacity: number;
  price: number;
  wasted: number;
  wasteCost: number;
  turnedAway: number;
  rivalLow: number | null;
  rivalHigh: number | null;
  refPrice: number;
  marginPerUnit: number;
  supplyExtra: number;
  playerSaved?: number;
  credit: { units: number; amount: number } | null;
  creditDeclined: boolean;
  slots: boolean;
  unusedSlots: number;
};

const naira = (n: number) => (n < 0 ? "−₦" : "₦") + Math.abs(Math.round(n)).toLocaleString("en-NG");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "What happened and why": 1 to 3 short lessons from the day's numbers. */
export function dayTips(d: TipInput): Tip[] {
  const tips: string[] = [];
  if (d.wasted >= 2) {
    tips.push(`You prepared ${plural(d.wasted, d.unit)} more than you sold, and they spoiled tonight. That cost you ${naira(d.wasteCost)}. Prepare closer to the customers you expect.`);
  }
  if (d.turnedAway >= 2) {
    tips.push(
      `You sold out and turned away ${plural(d.turnedAway, "customer")}. That's ${naira(d.turnedAway * d.price)} of sales you missed. ` +
        (d.units >= d.capacity ? "You're at full capacity, so try a slightly higher price." : "Prepare a few more, or raise your price a little."),
    );
  }
  if (d.slots && d.unusedSlots >= 3 && d.turnedAway === 0) {
    tips.push(`${plural(d.unusedSlots, d.unit)} went unbooked. Empty slots cost nothing to keep, but a lower price could fill them.`);
  }
  const low = d.rivalLow ?? d.refPrice * 0.9;
  const high = d.rivalHigh ?? d.refPrice * 1.1;
  if (d.price > high * 1.15) {
    tips.push(`Your price (${naira(d.price)}) was well above rivals (${naira(low)}–${naira(high)}), so many customers went elsewhere.`);
  } else if (d.price < low * 0.85 && d.marginPerUnit < d.price * 0.3) {
    tips.push(`Your low price brought people in, but each ${d.unit} only made ${naira(d.marginPerUnit)}. A small rise would earn more per sale.`);
  }
  if (d.playerSaved && d.playerSaved > 0) {
    tips.push(`Buying supplies from a player saved you ${naira(d.playerSaved)} compared with the backup market.`);
  } else if (d.supplyExtra > 0) {
    tips.push(`The backup market cost you ${naira(d.supplyExtra)} more than buying at the normal lot price. Player suppliers are usually cheaper.`);
  }
  if (d.credit) {
    tips.push(`Giving credit built loyalty, but ${naira(d.credit.amount)} isn't in your till until it's paid. Cash is not the same as profit.`);
  } else if (d.creditDeclined) {
    tips.push("Declining credit kept your cash safe. Regulars sometimes remember it, so watch their visits.");
  }
  if (tips.length === 0) tips.push("Good balance today: you prepared close to demand and priced in line with the market.");
  return tips.slice(0, 3).map((text) => ({ text }));
}

/** Silver and above need a track record: at least this many days opened and customers served. */
export const BAND_MIN_DAYS = 7;
export const BAND_MIN_SERVED = 20;
/** In a state with fewer businesses than this, nobody goes above Silver (too few to compare against). */
export const BAND_MIN_STATE_BUSINESSES = 5;

export type Band = "Bronze" | "Silver" | "Gold" | "Diamond";

/** Business Score band shown publicly instead of the number, after the track-record and small-state rules. */
export function scoreBand(score: number, gate: { days: number; served: number; stateBusinesses: number }): Band {
  const raw: Band = score >= 0.8 ? "Diamond" : score >= 0.6 ? "Gold" : score >= 0.4 ? "Silver" : "Bronze";
  if (raw === "Bronze") return raw;
  if (gate.days < BAND_MIN_DAYS || gate.served < BAND_MIN_SERVED) return "Bronze";
  if (gate.stateBusinesses < BAND_MIN_STATE_BUSINESSES) return "Silver";
  return raw;
}
