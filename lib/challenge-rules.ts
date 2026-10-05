/**
 * Challenge rules with no database or server imports, so they run anywhere and are unit-tested
 * (tests/challenges.test.mjs): the prize pool, prize amounts, post links and handles.
 */

export type PoolSettings = {
  pool_base: number;
  pool_step_entries: number;
  pool_step_amount: number;
  pool_cap: number;
};

export type Prize = { key: string; label: string; pct: number };

/** Base pool plus a step for every full `pool_step_entries` approved entries, never above the cap. */
export function poolFor(c: PoolSettings, approvedEntries: number) {
  const steps = Math.floor(Math.max(0, approvedEntries) / c.pool_step_entries);
  return Math.min(c.pool_cap, c.pool_base + steps * c.pool_step_amount);
}

/** How many more approved entries add the next step, or null once the pool is at its cap. */
export function nextStep(c: PoolSettings, approvedEntries: number) {
  const pool = poolFor(c, approvedEntries);
  if (pool >= c.pool_cap || c.pool_step_amount <= 0) return null;
  const n = Math.max(0, approvedEntries);
  const need = c.pool_step_entries - (n % c.pool_step_entries);
  return { entries: need, amount: Math.min(c.pool_step_amount, c.pool_cap - pool) };
}

/** Each prize's naira amount from the pool, rounded down to the nearest ₦100. */
export function prizeAmounts(pool: number, split: Prize[]) {
  return split.map((p) => ({ ...p, amount: Math.floor((pool * p.pct) / 100 / 100) * 100 }));
}

/** Checks a prize split from the admin form: unique keys, labels, whole percentages adding up to 100. */
export function splitProblem(split: Prize[]): string | null {
  if (split.length === 0) return "Add at least one prize.";
  const keys = new Set(split.map((p) => p.key));
  if (keys.size !== split.length) return "Each prize needs its own key.";
  if (split.some((p) => !/^[a-z0-9_]{1,30}$/.test(p.key) || !p.label.trim())) return "Each prize needs a key (a-z, 0-9, _) and a label.";
  if (split.some((p) => !Number.isInteger(p.pct) || p.pct <= 0)) return "Percentages must be whole numbers above 0.";
  const total = split.reduce((s, p) => s + p.pct, 0);
  return total === 100 ? null : `The percentages add up to ${total}%, not 100%.`;
}

/** One prize per person: the user ids that were picked for more than one prize. */
export function duplicateWinners(picks: { prize_key: string; user_id: string }[]) {
  const seen = new Map<string, number>();
  for (const p of picks) seen.set(p.user_id, (seen.get(p.user_id) ?? 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
}

export type Platform = "x" | "tiktok" | "instagram";
export const PLATFORMS: Platform[] = ["x", "tiktok", "instagram"];
export const PLATFORM_LABEL: Record<Platform, string> = { x: "X", tiktok: "TikTok", instagram: "Instagram" };

export const FORMATS = ["video", "skit", "meme_art", "song", "carousel", "other"] as const;
export type Format = (typeof FORMATS)[number];
export const FORMAT_LABEL: Record<Format, string> = {
  video: "Video",
  skit: "Skit",
  meme_art: "Meme or art",
  song: "Song",
  carousel: "Carousel",
  other: "Other",
};

/**
 * A pasted post link, checked and cleaned: https only, a real post on X, TikTok or Instagram,
 * with tracking parameters, fragments and trailing slashes removed, so the same post always looks the same.
 */
export function normalizePostUrl(raw: string): { platform: Platform; url: string } | { error: string } {
  let u: URL;
  try {
    u = new URL(raw.trim().replace(/^(?!https?:\/\/)/i, "https://"));
  } catch {
    return { error: "That doesn't look like a link. Copy it from the post's Share button." };
  }
  const host = u.hostname.toLowerCase().replace(/^(www\.|mobile\.|m\.)/, "");
  const path = u.pathname.replace(/\/+$/, "");
  let m: RegExpMatchArray | null;

  if (host === "x.com" || host === "twitter.com") {
    if ((m = path.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})$/))) {
      return { platform: "x", url: `https://x.com/${m[1].toLowerCase()}/status/${m[2]}` };
    }
    return { error: "Use the link to your post on X (it has /status/ in it)." };
  }
  if (host === "tiktok.com") {
    if ((m = path.match(/^\/@([A-Za-z0-9_.]{2,24})\/(video|photo)\/(\d{5,25})$/))) {
      return { platform: "tiktok", url: `https://www.tiktok.com/@${m[1].toLowerCase()}/${m[2]}/${m[3]}` };
    }
    return { error: "Use the full link to your TikTok (it has /video/ in it). Open the post in a browser and copy that link." };
  }
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") {
    return { error: "Short TikTok links can't be checked. Open the post in a browser and copy the full link with /video/ in it." };
  }
  if (host === "instagram.com") {
    if ((m = path.match(/^(?:\/[A-Za-z0-9_.]{1,30})?\/(p|reel|reels)\/([A-Za-z0-9_-]{5,40})$/))) {
      return { platform: "instagram", url: `https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}` };
    }
    return { error: "Use the link to your Instagram post or reel (it has /p/ or /reel/ in it)." };
  }
  return { error: "Post links must be from X, TikTok or Instagram." };
}

/** "@Name", "name" or a profile link, as a clean handle without the @ (or null when it isn't one). */
export function cleanHandle(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  const fromUrl = s.match(/(?:x\.com|twitter\.com|tiktok\.com|instagram\.com)\/@?([A-Za-z0-9_.]+)/i);
  if (fromUrl) s = fromUrl[1];
  s = s.replace(/^@/, "");
  return /^[A-Za-z0-9_.]{2,30}$/.test(s) ? s : null;
}
