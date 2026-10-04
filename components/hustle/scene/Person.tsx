import { hash32 } from "@/lib/hustle/engine";

/** Scene palette: Kopamate's lime, pink and dark, plus warm earth tones. */
export const P = {
  lime: "#c6f432",
  pink: "#ff4fa3",
  dark: "#0e0e10",
  cream: "#f5f5f0",
  wall: "#f2e3c6",
  wood: "#a0522d",
  woodTop: "#c26a3a",
  woodDark: "#7a2e14",
  inside: "#3a1d10",
  ground: "#6b4a2f",
  road: "#4a3424",
  kerb: "#c9b28c",
  steel: "#3a3a42",
  sun: "#fff3d6",
  yellow: "#f2c230",
} as const;

const SKIN = ["#8d5524", "#c68642", "#5c3a1e", "#a0662d", "#7a4a24"];
const SHIRT = ["#5aa9ff", "#ff4fa3", "#c6f432", "#f2c230", "#b9a6ff", "#7ff0d8", "#ff8a3d"];
const HAIR = ["#1a1a1a", "#2b1a10", "#3a2414"];

export type Look = { skin: string; shirt: string; hair: string };

/** The same person every time for the same id (a player's user id, or a seed for townspeople). */
export function lookFor(id: string): Look {
  const h = hash32(id);
  return { skin: SKIN[h % SKIN.length], shirt: SHIRT[(h >>> 3) % SHIRT.length], hair: HAIR[(h >>> 6) % HAIR.length] };
}

export type HairState = "neat" | "messy";

/** A shop owner or barber: head, face and shirt, 48×84. Hair is messy when grooming is overdue. */
export function Owner({ look, hair = "neat", apron = true, legs = false, width = 48 }: { look: Look; hair?: HairState; apron?: boolean; legs?: boolean; width?: number }) {
  return (
    <svg viewBox="0 0 48 84" width={width} height={(width * 84) / 48} aria-hidden="true" className="block">
      <circle cx="24" cy="16" r="12" fill={look.skin} />
      <circle cx="20" cy="17" r="1.6" fill="#1a1a1a" />
      <circle cx="28" cy="17" r="1.6" fill="#1a1a1a" />
      <path d="M19 22Q24 26 29 22" fill="none" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="8" y="30" width="32" height="40" rx="10" fill={look.shirt} />
      {apron && <rect x="14" y="40" width="20" height="30" rx="4" fill={P.cream} />}
      {legs && (
        <>
          <rect x="13" y="68" width="9" height="16" rx="3" fill="#2b2b33" />
          <rect x="26" y="68" width="9" height="16" rx="3" fill="#2b2b33" />
        </>
      )}
      {hair === "messy" ? (
        <path d="M11 14L9 4L16 9L18 1L23 8L27 0L30 8L36 2L36 10L41 7L37 15Z" fill={look.hair} />
      ) : (
        <path d="M12 14Q12 3 24 3Q36 3 36 14Q30 9 24 9Q18 9 12 14Z" fill={look.hair} />
      )}
    </svg>
  );
}

/** A small walking figure, 28×50 (customers, the street). */
export function Walker({ look, width = 28 }: { look: Look; width?: number }) {
  return (
    <svg viewBox="0 0 28 50" width={width} height={(width * 50) / 28} aria-hidden="true" className="block">
      <circle cx="14" cy="9" r="7" fill={look.skin} />
      <path d="M7 8Q14 0 21 8Z" fill={look.hair} />
      <rect x="6" y="17" width="16" height="18" rx="5" fill={look.shirt} />
      <rect x="8" y="34" width="5" height="14" rx="2" fill="#2b2b33" />
      <rect x="15" y="34" width="5" height="14" rx="2" fill="#2b2b33" />
    </svg>
  );
}

/** Lagos time of day, for the sky. */
export function timeOfDay(now = new Date()): "morning" | "day" | "evening" | "night" {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Lagos" }).format(now));
  if (h >= 20 || h < 6) return "night";
  if (h >= 17) return "evening";
  if (h < 11) return "morning";
  return "day";
}

export const SKY = { morning: "#ffcf7a", day: "#8fd3f4", evening: "#f29e6b", night: "#2a3352" } as const;
