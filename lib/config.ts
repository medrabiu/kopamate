export const APP_NAME = "Kopamate";

/** What search engines and link previews show for the site. */
export const SITE_TITLE = `${APP_NAME}: the app for NYSC corps members in Nigeria`;
export const SITE_DESCRIPTION =
  `${APP_NAME} is the free app for NYSC corps members across Nigeria. Find corpers serving in your state, earn badges for your service year, and win prizes, contests and awards made for corpers.`;

/**
 * Public address of the app, used in invite links, share previews and Google sign-in.
 * On Vercel's production deployment a missing or localhost APP_URL (e.g. copied from a local .env)
 * falls back to the project's production domain, so shared links never point at localhost.
 * Common slips are fixed (quotes, spaces, "APP_URL=" pasted into the value, no "https://"); anything
 * else that isn't a valid address stops the build with a message naming APP_URL.
 */
function appUrl() {
  let set = (process.env.APP_URL || "").trim().replace(/^APP_URL\s*=\s*/, "").replace(/^["']|["']$/g, "").trim();
  if (set && !/^https?:\/\//i.test(set)) set = `${/^(localhost|127\.0\.0\.1)(:|$)/.test(set) ? "http" : "https"}://${set}`;
  const onVercelProd = process.env.VERCEL_ENV === "production";
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (onVercelProd && vercelDomain && (!set || /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(set))) {
    return `https://${vercelDomain}`;
  }
  const url = set || "http://localhost:3000";
  try {
    return new URL(url).origin;
  } catch {
    throw new Error(`APP_URL is not a valid web address (got "${url}"). Set it to the full address, like https://kopamate.ng`);
  }
}

export const APP_URL = appUrl();

/** How many places each valid referral moves someone up. */
export const PLACES_PER_REFERRAL = 10;

/** Prize thresholds. */
export const FIRST_N = 500;
export const TOP_REFERRERS = 10;

/** Signup limits per IP (hashed) per hour. */
export const MAX_SIGNUPS_PER_IP_PER_HOUR = 5;

/** PIN lockout. */
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;

/** Users can change their state once every N days. */
export const STATE_CHANGE_DAYS = 30;

export const SESSION_DAYS = 60;

/** Defaults for the reward settings an admin can change (Africa/Lagos times). */
export const DEFAULT_EARLY_DEADLINE = "2026-10-02T23:59:59+01:00";
export const DEFAULT_LEADERBOARD_CLOSE = "2026-10-21T23:59:59+01:00";
export const DEFAULT_REWARDS_REVEAL_TEXT = "Prizes are revealed when the countdown ends.";

export const googleEnabled = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function referralLink(code: string) {
  return `${APP_URL}/r/${code}`;
}

export function shareMessage(code: string) {
  return `I just joined ${APP_NAME}, the new app for corpers across Nigeria 🇳🇬 There are prizes for the first 500 people. Join with my link: ${referralLink(code)}`;
}

export function whatsappShareUrl(code: string, message = shareMessage(code)) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
