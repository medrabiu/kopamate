import { createHash, randomBytes, randomInt } from "crypto";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** Hash an IP so we can spot bulk sign-ups without storing raw IPs. */
export function hashIp(ip: string | null) {
  if (!ip) return null;
  return sha256(`${process.env.SESSION_SECRET || "kopamate"}:${ip}`).slice(0, 32);
}

export function clientIp(h: Headers) {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

export function referralCodeBase(nickname: string) {
  const base = nickname.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  return base.length >= 2 ? base : "kopa";
}

export function randomDigits(n: number) {
  return String(randomInt(0, 10 ** n)).padStart(n, "0");
}

/** Today's date in Lagos as YYYY-MM-DD. */
export function lagosDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-NG").format(n);
}

export function timeAgo(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 172800) return "Yesterday";
  return `${Math.floor(s / 86400)} days ago`;
}

export function formatJoined(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(d);
}

const AVATAR_COLORS = ["#C6F432", "#FF4FA3", "#FFB547", "#8B7BFF", "#4FD1C5"];

export function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
