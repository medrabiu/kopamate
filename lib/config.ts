export const APP_NAME = "Kopamate";

/**
 * Public address of the app, used in invite links, share previews and Google sign-in.
 * On Vercel's production deployment a missing or localhost APP_URL (e.g. copied from a local .env)
 * falls back to the project's production domain, so shared links never point at localhost.
 */
function appUrl() {
  const set = (process.env.APP_URL || "").trim();
  const onVercelProd = process.env.VERCEL_ENV === "production";
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (onVercelProd && vercelDomain && (!set || /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(set))) {
    return `https://${vercelDomain}`;
  }
  return set || "http://localhost:3000";
}

export const APP_URL = appUrl().replace(/\/$/, "");

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

export const DEFAULT_PRIZE_TEXT =
  "For the first 500 signups and the top 10 referrers. Announced soon.";

export const googleEnabled = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function referralLink(code: string) {
  return `${APP_URL}/r/${code}`;
}

export function shareMessage(code: string) {
  return `I just joined ${APP_NAME}, the new app for corpers across Nigeria 🇳🇬 There are prizes for the first 500 people. Join with my link: ${referralLink(code)}`;
}

export function whatsappShareUrl(code: string) {
  return `https://wa.me/?text=${encodeURIComponent(shareMessage(code))}`;
}
