import { ABUSIVE_WORDS, RESERVED_USERNAME_WORDS } from "./word-filter";

/**
 * Normalise a Nigerian mobile number to E.164 (+234XXXXXXXXXX).
 * Accepts 0803..., 803..., 234803..., +234 803 ... Returns null if invalid.
 */
export function normalizeNigerianPhone(input: string): string | null {
  let digits = (input || "").replace(/\D/g, "");
  if (digits.startsWith("234")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[789][01]\d{8}$/.test(digits)) return null;
  return `+234${digits}`;
}

export function maskPhone(e164: string | null) {
  if (!e164) return "Not added";
  const local = e164.replace("+234", "0");
  return `${local.slice(0, 4)} ••• ${local.slice(-4)}`;
}

// Words we don't allow in usernames (lib/word-filter.ts). Extend there; admins can also rename.
const BLOCKED = [...ABUSIVE_WORDS.filter((w) => !w.includes(" ")), ...RESERVED_USERNAME_WORDS];

/** Usernames, like on X: 2 to 20 letters, numbers, _ or ., at least one letter. Unique ignoring capitals (see lib/signup.ts). */
export const USERNAME_RULES = "2 to 20 letters, numbers, _ or . (no spaces)";

export function validateUsername(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = (raw || "").trim().replace(/^@/, "");
  if (/\s/.test(value)) return { ok: false, error: "No spaces in usernames. Use _ instead, like ada_obi." };
  if (value.length < 2 || value.length > 20) return { ok: false, error: "Username must be 2 to 20 characters." };
  if (!/^[A-Za-z0-9_.]+$/.test(value)) return { ok: false, error: "Use letters, numbers, _ or . only." };
  if (!/[A-Za-z]/.test(value)) return { ok: false, error: "Include at least one letter." };
  const squashed = value.toLowerCase().replace(/[^a-z]/g, "");
  if (BLOCKED.some((w) => (w.length <= 4 ? squashed === w : squashed.includes(w)))) {
    return { ok: false, error: "Choose a different username." };
  }
  return { ok: true, value };
}

/** Turns any name into a username shape ("Ọlá Ade" → "Ola_Ade"), or "" if nothing usable is left. */
export function toUsername(raw: string) {
  return (raw || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_.]/g, "")
    .replace(/^[_.]+|[_.]+$/g, "")
    .slice(0, 20);
}

/** Full name: 2 to 60 characters, letters with spaces, hyphens, apostrophes and dots. Empty clears it. */
export function validateFullName(raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = (raw || "").trim().replace(/\s+/g, " ");
  if (!value) return { ok: true, value: null };
  if (value.length < 2 || value.length > 60) return { ok: false, error: "Full name must be 2 to 60 characters." };
  if (!/^[\p{L}][\p{L} '.-]*$/u.test(value)) return { ok: false, error: "Use letters, spaces, hyphens and apostrophes only." };
  return { ok: true, value };
}

export function validatePin(pin: string) {
  return /^\d{4}$/.test(pin || "");
}

/** Loose check for state codes like EN/26B/1234. */
export function normalizeStateCode(raw: string): string | null {
  const value = (raw || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!value) return "";
  if (!/^[A-Z]{2}\/\d{2}[A-C]\/\d{3,5}$/.test(value)) return null;
  return value;
}
