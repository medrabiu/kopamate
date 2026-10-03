export const STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo",
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
  "Yobe", "Zamfara",
] as const;

export type StateName = (typeof STATES)[number];

export function isState(value: unknown): value is StateName {
  return typeof value === "string" && (STATES as readonly string[]).includes(value);
}

export function stateSlug(state: string) {
  return state.toLowerCase().replace(/\s+/g, "-");
}

export function stateFromSlug(slug: string): StateName | null {
  return STATES.find((s) => stateSlug(s) === slug.toLowerCase()) ?? null;
}

/** The two letters every NYSC state code starts with, e.g. LA/26B/1234 for Lagos and FC/26B/1234 for Abuja (FCT). */
export const STATE_CODE_PREFIX: Record<StateName, string> = {
  Abia: "AB",
  Adamawa: "AD",
  "Akwa Ibom": "AK",
  Anambra: "AN",
  Bauchi: "BA",
  Bayelsa: "BY",
  Benue: "BN",
  Borno: "BO",
  "Cross River": "CR",
  Delta: "DT",
  Ebonyi: "EB",
  Edo: "ED",
  Ekiti: "EK",
  Enugu: "EN",
  FCT: "FC",
  Gombe: "GM",
  Imo: "IM",
  Jigawa: "JG",
  Kaduna: "KD",
  Kano: "KN",
  Katsina: "KT",
  Kebbi: "KB",
  Kogi: "KG",
  Kwara: "KW",
  Lagos: "LA",
  Nasarawa: "NS",
  Niger: "NG",
  Ogun: "OG",
  Ondo: "OD",
  Osun: "OS",
  Oyo: "OY",
  Plateau: "PL",
  Rivers: "RV",
  Sokoto: "SO",
  Taraba: "TR",
  Yobe: "YB",
  Zamfara: "ZM",
};

/**
 * Checks a normalised state code (like LA/26B/1234) against the state the user serves in: the prefix must
 * be that state's, and the batch year must be recent (this year, last year or the year before; next year is
 * allowed early in a batch's registration). Returns an error to show, or null when it's fine.
 */
export function stateCodeProblem(state: string | null, code: string, now = new Date()): string | null {
  const m = code.match(/^([A-Z]{2})\/(\d{2})[A-C]\/\d{3,5}$/);
  if (!m) return "State codes look like LA/26B/1234.";
  const expected = state && isState(state) ? STATE_CODE_PREFIX[state] : null;
  if (expected && m[1] !== expected) {
    return `State codes for ${state} start with ${expected}/, like ${expected}/26B/1234. Check your ID card.`;
  }
  const year = Number(m[2]);
  const thisYear = now.getFullYear() % 100;
  if (year > thisYear + 1 || year < thisYear - 2) return "That batch year isn't a current one. Check the state code on your ID card.";
  return null;
}
