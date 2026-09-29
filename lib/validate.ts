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

// Short list of words we don't allow in nicknames. Extend as needed (admin can also rename).
const BLOCKED = [
  "fuck", "fuk", "shit", "bitch", "cunt", "dick", "pussy", "nigger", "nigga", "whore",
  "slut", "bastard", "asshole", "ashawo", "olosho", "ode", "mumu", "werey", "oloshi",
  "admin", "kopamate", "nysc", "official",
];

export function validateNickname(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = (raw || "").trim().replace(/\s+/g, " ");
  if (value.length < 2 || value.length > 20) {
    return { ok: false, error: "Nickname must be 2 to 20 characters." };
  }
  if (!/^[\p{L}\p{N} _.]+$/u.test(value)) {
    return { ok: false, error: "Use letters, numbers, spaces, _ or . only." };
  }
  const squashed = value.toLowerCase().replace(/[^a-z]/g, "");
  if (BLOCKED.some((w) => (w.length <= 4 ? squashed === w : squashed.includes(w)))) {
    return { ok: false, error: "Choose a different nickname." };
  }
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
