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
