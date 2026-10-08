/**
 * Words we don't allow in usernames, bios, notes, school and course. Extend as needed; admins can also clear a
 * bio or rename someone. Free text is matched word by word (so "code" doesn't trip "ode"); usernames are
 * checked more strictly in lib/validate.ts.
 */
export const ABUSIVE_WORDS = [
  "fuck", "fuk", "fck", "shit", "bitch", "cunt", "dick", "pussy", "nigger", "nigga", "whore",
  "slut", "bastard", "asshole", "ashawo", "olosho", "ode", "mumu", "werey", "oloshi", "motherfucker",
  "fucker", "fucking", "bitches", "whores", "sluts", "dickhead", "retard", "idiot", "stupid", "ewu",
  "agbaya", "oloriburuku", "onye ara", "yeye", "dindin", "ashewo",
];

/** Reserved in usernames only (not offensive, just misleading). */
export const RESERVED_USERNAME_WORDS = ["admin", "kopamate", "nysc", "official"];

/** True when free text contains an abusive word (whole words, ignoring case, accents and l33t digits). */
export function hasAbuse(text: string): boolean {
  const flat = (text || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/\$/g, "s")
    .replace(/@/g, "a");
  const words = ` ${flat.replace(/[^a-z]+/g, " ").trim()} `;
  return ABUSIVE_WORDS.some((w) => words.includes(` ${w} `));
}
