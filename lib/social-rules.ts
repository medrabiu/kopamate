import { hasAbuse } from "./word-filter.ts";

/**
 * Rules for profiles and connecting. Pure functions (no database, no framework), so they run on the server, in
 * the browser and in tests (tests/social-rules.test.mjs).
 */

export const BIO_MAX = 160;
export const SCHOOL_MAX = 80;
export const COURSE_MAX = 80;
export const NOTE_MAX = 140;
export const REPORT_NOTE_MAX = 300;
export const INTEREST_MAX = 24;
export const INTERESTS_MAX = 5;

export const FOLLOWS_PER_DAY = 100;
export const HIS_PER_DAY = 10;
export const HIS_PENDING_MAX = 30;
export const HI_COOLDOWN_DAYS = 30;
export const USERNAME_CHANGE_DAYS = 30;
/** Auto-flag someone whose "Say hi" requests are mostly ignored. */
export const HI_FLAG_MIN_IGNORED = 20;
export const HI_FLAG_MAX_ACCEPT_RATE = 0.1;

export const SUGGESTED_INTERESTS = [
  "Tech", "Design", "Content", "Fashion", "Food", "Fitness", "Finance", "Photography", "Teaching", "Music", "Writing", "Business", "Health",
];

export const OPEN_TO = ["work", "collab", "friends", "mentoring"] as const;
export type OpenTo = (typeof OPEN_TO)[number];
export const OPEN_TO_LABEL: Record<OpenTo, string> = {
  work: "Work",
  collab: "Collabs",
  friends: "New friends",
  mentoring: "Mentoring",
};

export const HI_POLICIES = ["everyone", "following", "nobody"] as const;
export type HiPolicy = (typeof HI_POLICIES)[number];
export const HI_POLICY_LABEL: Record<HiPolicy, string> = {
  everyone: "Everyone",
  following: "People I follow",
  nobody: "No one",
};

export const REPORT_REASONS = ["fake", "harassment", "spam", "inappropriate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  fake: "Fake account",
  harassment: "Harassment or bullying",
  spam: "Spam or scam",
  inappropriate: "Inappropriate photo or text",
  other: "Something else",
};

// ---------- Text ----------

/** Trims and collapses spaces and line breaks into single spaces. */
export const tidy = (s: string) => (s || "").replace(/\s+/g, " ").trim();

/** Anything that looks like a link or a web address. Links go in the Links field only. */
export function hasLink(text: string): boolean {
  return /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|ng|net|org|io|co|me|ly|app|xyz|info|link|site|online|biz)\b|wa\.me|t\.me|bit\.ly)/i.test(text || "");
}

type TextCheck = { ok: true; value: string | null } | { ok: false; error: string };

/** Free text shown on a profile (bio) or in a request (note): length, no links, no abuse. Empty clears it. */
export function checkText(raw: string, label: string, max: number, allowLinks = false): TextCheck {
  const value = tidy(raw);
  if (!value) return { ok: true, value: null };
  if (value.length > max) return { ok: false, error: `${label} can be at most ${max} characters.` };
  if (!allowLinks && hasLink(value)) {
    return { ok: false, error: label === "Bio" ? "No links in your bio. Add them under Links instead." : `No links in the ${label.toLowerCase()}, please.` };
  }
  if (hasAbuse(value)) return { ok: false, error: `Please change the wording of your ${label.toLowerCase()}.` };
  return { ok: true, value };
}

/** A school or course name: tidy, at most `max` characters, no links or abuse. */
export const checkName = (raw: string, label: string, max: number) => checkText(raw, label, max);

/** Interest tags: trimmed, at most 5, each at most 24 characters, no duplicates (ignoring case), no abuse. */
export function checkInterests(raw: string[]): { ok: true; value: string[] } | { ok: false; error: string } {
  const out: string[] = [];
  for (const r of raw) {
    const t = tidy(r).replace(/^#/, "");
    if (!t) continue;
    if (t.length > INTEREST_MAX) return { ok: false, error: `Interests can be at most ${INTEREST_MAX} characters each.` };
    if (hasLink(t) || hasAbuse(t)) return { ok: false, error: `“${t}” can't be used as an interest.` };
    if (!out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  if (out.length > INTERESTS_MAX) return { ok: false, error: `Pick at most ${INTERESTS_MAX} interests.` };
  return { ok: true, value: out };
}

export const checkOpenTo = (raw: string[]): OpenTo[] => OPEN_TO.filter((o) => raw.includes(o));

// ---------- Links ----------

export const LINK_KINDS = ["instagram", "x", "linkedin", "tiktok", "website"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];
export type Links = Partial<Record<LinkKind, string>>;
export const LINK_LABEL: Record<LinkKind, string> = { instagram: "Instagram", x: "X", linkedin: "LinkedIn", tiktok: "TikTok", website: "Website" };

const HANDLE = /^[A-Za-z0-9_.]{1,30}$/;

/**
 * A handle or profile link as a clean https URL, or an error. Handles become links to the right site;
 * links must be https and on that site. Websites must be https with a real hostname.
 */
export function parseLink(kind: LinkKind, raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const input = (raw || "").trim();
  if (!input) return { ok: true, value: null };
  const label = LINK_LABEL[kind];
  if (kind === "website") {
    let u: URL;
    try {
      u = new URL(input.includes("://") ? input : `https://${input}`);
    } catch {
      return { ok: false, error: "Website: that isn't a valid link." };
    }
    if (u.protocol !== "https:") return { ok: false, error: "Website: links must start with https://." };
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname) || u.username || u.password) return { ok: false, error: "Website: that isn't a valid link." };
    const out = u.toString();
    return out.length > 200 ? { ok: false, error: "Website: that link is too long." } : { ok: true, value: out };
  }
  const hosts: Record<Exclude<LinkKind, "website">, { re: RegExp; make: (h: string) => string }> = {
    instagram: { re: /^(?:https:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9_.]{1,30})\/?$/i, make: (h) => `https://www.instagram.com/${h}` },
    x: { re: /^(?:https:\/\/)?(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/?$/i, make: (h) => `https://x.com/${h}` },
    linkedin: { re: /^(?:https:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9_-]{3,100})\/?$/i, make: (h) => `https://www.linkedin.com/in/${h}` },
    tiktok: { re: /^(?:https:\/\/)?(?:www\.)?tiktok\.com\/@([A-Za-z0-9_.]{2,24})\/?$/i, make: (h) => `https://www.tiktok.com/@${h}` },
  };
  const { re, make } = hosts[kind];
  if (/^http:\/\//i.test(input)) return { ok: false, error: `${label}: links must start with https://.` };
  const m = input.match(re);
  if (m) return { ok: true, value: make(m[1]) };
  const handle = input.replace(/^@/, "");
  if (!input.includes("/") && (kind === "linkedin" ? /^[A-Za-z0-9_-]{3,100}$/ : HANDLE).test(handle)) return { ok: true, value: make(handle) };
  return { ok: false, error: `${label}: use your handle (like @yourname) or a link to your ${label} profile.` };
}

/** Saved links read back safely: only the five kinds, only https URLs. */
export function cleanLinks(raw: unknown): Links {
  const out: Links = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of LINK_KINDS) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === "string" && v.startsWith("https://")) out[k] = v;
  }
  return out;
}

// ---------- Profile strength ----------

export type StrengthInput = {
  photo: boolean;
  bio: string | null;
  school: string | null;
  course: string | null;
  interests: string[];
  open_to: string[];
  links: Links;
};

const STRENGTH = [
  { key: "photo", points: 20, done: (p: StrengthInput) => p.photo, hint: "add a photo so people recognise you" },
  { key: "bio", points: 20, done: (p: StrengthInput) => Boolean(p.bio), hint: "add a short bio" },
  { key: "school", points: 15, done: (p: StrengthInput) => Boolean(p.school), hint: "add your school so classmates can find you" },
  { key: "course", points: 10, done: (p: StrengthInput) => Boolean(p.course), hint: "add your course" },
  { key: "interests", points: 15, done: (p: StrengthInput) => p.interests.length > 0, hint: "add your interests" },
  { key: "open_to", points: 10, done: (p: StrengthInput) => p.open_to.length > 0, hint: "say what you're open to" },
  { key: "links", points: 10, done: (p: StrengthInput) => Object.keys(p.links).length > 0, hint: "add a link to your Instagram, X or LinkedIn" },
] as const;

/** Profile strength out of 100, and the first thing missing (in the order above). */
export function profileStrength(p: StrengthInput) {
  const score = STRENGTH.reduce((s, x) => s + (x.done(p) ? x.points : 0), 0);
  const missing = STRENGTH.find((x) => !x.done(p));
  return { score, missing: missing ? { key: missing.key, hint: missing.hint } : null };
}

// ---------- People like you ----------

export type Likeness = { school: string | null; course: string | null; state: string | null; interests: string[] };

const same = (a: string | null, b: string | null) => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

/** How alike two people are: school 3, course 2, state 2, 1 per shared interest (ignoring case). Mirrors the SQL. */
export function likeness(me: Likeness, other: Likeness) {
  const mine = new Set(me.interests.map((i) => i.toLowerCase()));
  return (
    (same(me.school, other.school) ? 3 : 0) +
    (same(me.course, other.course) ? 2 : 0) +
    (same(me.state, other.state) ? 2 : 0) +
    other.interests.filter((i) => mine.has(i.toLowerCase())).length
  );
}

// ---------- Usernames ----------

/** Whether the username can be changed now, and if not, from when. */
export function usernameChange(changedAt: Date | null, now = new Date()) {
  if (!changedAt) return { allowed: true as const };
  const next = new Date(changedAt.getTime() + USERNAME_CHANGE_DAYS * 86_400_000);
  return next <= now ? { allowed: true as const } : { allowed: false as const, next };
}

/** "@name" or "%40name" from a /u/ link: the username part, or null when it isn't one. */
export function handleFromPath(segment: string): string | null {
  const s = decodeURIComponent(segment);
  return s.startsWith("@") && /^@[A-Za-z0-9_.]{2,20}$/.test(s) ? s.slice(1) : null;
}

/** The in-app link to someone's profile. */
export const profileHref = (nickname: string) => `/u/@${nickname}`;

/** The WhatsApp link shown after an accepted "Say hi". */
export const waLink = (e164: string) => `https://wa.me/${e164.replace(/\D/g, "")}?text=${encodeURIComponent("Hi from Kopamate")}`;
