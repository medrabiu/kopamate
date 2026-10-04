import { BizGlyph } from "../BizArt";
import { Owner, P, Walker, type HairState, type Look } from "./Person";

/** Which drawing a business type gets. Types without their own art use "generic" (recoloured, with the type icon). */
export type Family = "buka" | "barber" | "salon" | "laundry" | "pos" | "farm" | "generic";

export function familyFor(typeSlug: string): Family {
  if (typeSlug === "buka" || typeSlug === "suya_spot") return "buka";
  if (typeSlug === "barber") return "barber";
  if (typeSlug === "salon") return "salon";
  if (typeSlug === "laundry") return "laundry";
  if (typeSlug === "pos_agent") return "pos";
  if (typeSlug === "crop_farm") return "farm";
  return "generic";
}

export type StageState = "closed" | "preparing" | "open" | "done";

export type StageWalker = { key: string; left: number; opacity?: number; bob?: boolean; look: Look; tag?: string };

type Props = {
  name: string;
  color: string;
  icon: string;
  family: Family;
  sky: string;
  night?: boolean;
  state: StageState;
  owner: Look;
  hair: HairState;
  /** Units on the counter (shown up to 24). */
  items: number;
  steam?: boolean;
  generator?: boolean;
  walkers?: StageWalker[];
  soldOut?: boolean;
  bubble?: string | null;
  /** Short text alternative for the whole scene. */
  label: string;
};

const W = 390;
const H = 380;
/** Places an overlay in scene coordinates, so the whole scene scales with the screen width. */
const at = (x: number, y: number, w?: number, h?: number): React.CSSProperties => ({
  position: "absolute",
  left: `${(x / W) * 100}%`,
  top: `${(y / H) * 100}%`,
  ...(w !== undefined ? { width: `${(w / W) * 100}%` } : {}),
  ...(h !== undefined ? { height: `${(h / H) * 100}%` } : {}),
});

/** A small item on the counter: what this kind of business sells. */
function Item({ family, color }: { family: Family; color: string }) {
  if (family === "buka")
    return (
      <span className="hz-pop flex h-2 w-[15px] items-center justify-center rounded-[50%] border border-[#c9c2b0] bg-[#f5f5f0]">
        <span className="h-1 w-2 rounded-[50%] bg-[#e2542b]" />
      </span>
    );
  if (family === "laundry") return <span className="hz-pop h-2 w-[14px] rounded-sm" style={{ background: color, boxShadow: "inset 0 -3px 0 rgba(0,0,0,.2)" }} />;
  if (family === "farm") return <span className="hz-pop h-[9px] w-[12px] rounded-sm bg-[#a0522d]" style={{ boxShadow: `inset 0 3px 0 ${P.lime}` }} />;
  if (family === "pos") return <span className="hz-pop h-[7px] w-[14px] rounded-sm bg-[#4ea85a]" />;
  if (family === "barber" || family === "salon") return <span className="hz-pop h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: color }} />;
  return <span className="hz-pop h-[9px] w-[11px] rounded-sm" style={{ background: color, opacity: 0.85 }} />;
}

/** The sign on the building: the business name, smaller for long names. */
function Sign({ name, x, y, w, h }: { name: string; x: number; y: number; w: number; h: number }) {
  const text = name.toUpperCase();
  const size = Math.min(19, Math.max(10, (w / text.length) * 1.55));
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="8" fill={P.dark} />
      <text x={x + w / 2} y={y + h / 2 + size / 3} textAnchor="middle" fontWeight="800" fontSize={size} fill={P.lime} style={{ fontFamily: "var(--font-display)" }}>
        {text}
      </text>
    </g>
  );
}

function Awning({ color, x1 = 44, x2 = 346, y = 92 }: { color: string; x1?: number; x2?: number; y?: number }) {
  const n = 10;
  const step = (x2 - x1) / n;
  const stripes = Array.from({ length: n }, (_, i) => i).filter((i) => i % 2 === 0);
  const scallop = Array.from({ length: n }, (_, i) => `Q${x1 + step * i + step / 2} ${y + 32} ${x1 + step * (i + 1)} ${y + 20}`).join(" ");
  return (
    <g>
      <rect x={x1} y={y} width={x2 - x1} height="20" fill={color} />
      {stripes.map((i) => (
        <rect key={i} x={x1 + step * i} y={y} width={step} height="20" fill={P.cream} />
      ))}
      <path d={`M${x1} ${y + 20}${scallop}Z`} fill={color} />
    </g>
  );
}

/** What you see through the doorway, by type. */
function Interior({ family, color }: { family: Family; color: string }) {
  switch (family) {
    case "barber":
      return (
        <g>
          <rect x="60" y="130" width="270" height="130" fill="#2b3a4a" />
          <rect x="160" y="140" width="80" height="56" rx="28" fill="#9fc4e6" stroke="#1a2633" strokeWidth="5" />
          <rect x="300" y="138" width="10" height="72" rx="5" fill={P.cream} />
          <path d="M300 146L310 140M300 160L310 154M300 174L310 168M300 188L310 182M300 202L310 196" stroke="#e2542b" strokeWidth="4" />
        </g>
      );
    case "salon":
      return (
        <g>
          <rect x="60" y="130" width="270" height="130" fill="#4a1a3a" />
          <ellipse cx="200" cy="168" rx="34" ry="28" fill="#ff8fc4" opacity="0.8" />
          <rect x="250" y="140" width="56" height="60" rx="8" fill="#ffd6ea" />
          <circle cx="278" cy="160" r="10" fill="#4a1a3a" />
        </g>
      );
    case "laundry":
      return (
        <g>
          <rect x="60" y="130" width="270" height="130" fill="#2a1f4a" />
          {[180, 240].map((x) => (
            <g key={x}>
              <rect x={x} y="140" width="46" height="56" rx="6" fill={P.cream} />
              <circle cx={x + 23} cy="172" r="15" fill="#7fc4ff" />
              <circle cx={x + 23} cy="172" r="15" fill="none" stroke="#5a5a66" strokeWidth="3" />
            </g>
          ))}
        </g>
      );
    case "buka":
      return (
        <g>
          <rect x="60" y="130" width="270" height="130" fill={P.inside} />
          <rect x="72" y="140" width="60" height="6" rx="3" fill="#5a2e18" />
          <rect x="250" y="140" width="66" height="6" rx="3" fill="#5a2e18" />
        </g>
      );
    default:
      return (
        <g>
          <rect x="60" y="130" width="270" height="130" fill={P.inside} />
          {[0, 1, 2].map((r) => (
            <rect key={r} x="220" y={142 + r * 24} width="96" height="5" rx="2" fill="#5a2e18" />
          ))}
          {[0, 1, 2].map((r) => (
            <rect key={`b${r}`} x={228 + r * 28} y={130 + 24} width="18" height="12" rx="2" fill={color} opacity="0.6" />
          ))}
        </g>
      );
  }
}

/**
 * The player's shop, about 390×380, scaled to the screen width. Static art is one SVG; the owner, stock,
 * shutter, customers and signs are overlays placed in the same coordinates, so CSS can move them.
 */
export default function ShopStage(p: Props) {
  const stall = p.family === "pos" || p.family === "farm";
  const shutterY = p.state === "open" ? "-100%" : p.state === "preparing" ? "-55%" : "0";
  const shown = Math.min(24, Math.max(0, p.items));
  return (
    <div role="img" aria-label={p.label} className="relative w-full overflow-hidden" style={{ aspectRatio: `${W} / ${H}`, background: p.sky }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
        {p.night ? <circle cx="335" cy="44" r="16" fill="#e8ecff" opacity="0.9" /> : <circle cx="335" cy="44" r="22" fill={P.sun} opacity="0.8" />}
        {!stall && (
          <>
            <rect x="0" y="120" width="40" height="180" fill="#e9b45f" />
            <rect x="356" y="100" width="34" height="200" fill="#e9b45f" />
            <rect x="30" y="72" width="330" height="230" fill={p.family === "barber" ? "#dfe9f5" : p.family === "salon" ? "#ffd6ea" : p.family === "laundry" ? "#e6e0ff" : P.wall} />
            <rect x="22" y="64" width="346" height="14" rx="3" fill={P.woodDark} />
            <Sign name={p.name} x={95} y={20} w={200} h={40} />
            <rect x="190" y="60" width="3" height="10" fill={P.dark} />
            <rect x="197" y="60" width="3" height="10" fill={P.dark} />
            <Awning color={p.color} />
            <Interior family={p.family} color={p.color} />
          </>
        )}
        {p.family === "pos" && (
          <>
            <Sign name={p.name} x={95} y={18} w={200} h={36} />
            <path d="M70 120Q195 30 320 120Z" fill={p.color} />
            <path d="M70 120Q132 96 195 120Q258 96 320 120" fill="none" stroke={P.dark} strokeWidth="3" />
            <rect x="192" y="118" width="6" height="110" fill="#5a5a56" />
          </>
        )}
        {p.family === "farm" && (
          <>
            <rect x="50" y="96" width="290" height="30" fill="#1d3b1a" />
            <Sign name={p.name} x={95} y={52} w={200} h={36} />
            <rect x="58" y="126" width="8" height="110" fill={P.woodDark} />
            <rect x="324" y="126" width="8" height="110" fill={P.woodDark} />
            <path d="M50 96L195 62L340 96Z" fill={p.color} opacity="0.9" />
          </>
        )}
        <rect x="0" y="300" width={W} height="80" fill={P.ground} />
        <rect x="0" y="350" width={W} height="30" fill={P.road} />
        <path d="M0 364H40M70 364H110M140 364H180M210 364H250M280 364H320M350 364H390" stroke={P.kerb} strokeWidth="3" />
        <rect x="6" y="318" width="70" height="7" rx="2" fill={P.wood} />
        <rect x="12" y="325" width="5" height="16" fill={P.woodDark} />
        <rect x="64" y="325" width="5" height="16" fill={P.woodDark} />
      </svg>

      {p.family === "generic" && (
        <div style={at(64, 136, 40, 40)} className="flex items-center justify-center rounded-xl text-on-accent" aria-hidden="true">
          <span className="flex h-full w-full items-center justify-center rounded-xl" style={{ background: p.color }}>
            <BizGlyph icon={p.icon} size={22} />
          </span>
        </div>
      )}

      {/* Generator: shakes while it runs. */}
      <div style={at(324, 262, 40, 38)} aria-hidden="true">
        <div className={p.generator ? "hz-gen" : ""}>
          <svg viewBox="0 0 40 38" className="block h-auto w-full">
            <rect x="2" y="8" width="36" height="26" rx="4" fill={P.yellow} />
            <rect x="8" y="14" width="14" height="10" rx="2" fill={P.dark} />
            <circle cx="30" cy="20" r="4" fill={P.dark} />
            <rect x="6" y="34" width="6" height="4" fill={P.dark} />
            <rect x="28" y="34" width="6" height="4" fill={P.dark} />
            <rect x="30" y="2" width="4" height="8" fill="#555" />
          </svg>
        </div>
      </div>

      {/* The owner, behind the counter. */}
      <div style={at(112, 150, 48, 84)} aria-hidden="true">
        <Owner look={p.owner} hair={p.hair} width={48} />
      </div>

      {/* Counter with props and today's stock. */}
      <div
        style={{ ...at(60, 222, 270, 38), borderTop: `6px solid ${p.family === "pos" ? "#2b3a4a" : P.woodTop}`, background: p.family === "pos" ? "#123049" : P.wood }}
        className="flex items-start gap-1.5 px-2"
        aria-hidden="true"
      >
        {p.family === "buka" && <Pot steam={p.steam} />}
        {p.family === "pos" && (
          <span className="-mt-5 block h-6 w-9 shrink-0 rounded bg-[#0e0e10] p-1">
            <span className="block h-2 rounded-sm bg-[#7fc4ff]" />
          </span>
        )}
        <div className="-mt-4 flex h-7 flex-1 flex-wrap-reverse content-start gap-0.5 overflow-visible">
          {Array.from({ length: shown }, (_, i) => (
            <Item key={i} family={p.family} color={p.color} />
          ))}
        </div>
        {p.family === "buka" && <Pot steam={p.steam} second />}
      </div>

      {/* Shutter: down when closed, half up while preparing, up when open. */}
      <div style={{ ...at(60, 130, 270, 130), pointerEvents: "none" }} className="overflow-hidden" aria-hidden="true">
        <div
          className="hz-shutter flex h-full w-full items-center justify-center"
          style={{
            transform: `translateY(${shutterY})`,
            background: stall ? `repeating-linear-gradient(90deg, ${p.color} 0 18px, ${P.cream} 18px 36px)` : "repeating-linear-gradient(#9a9a94 0 9px, #7d7d78 9px 11px)",
          }}
        >
          {(p.state === "closed" || p.state === "done") && (
            <span className="rounded-md bg-[#0e0e10] px-3 py-1.5 text-[clamp(11px,3.6vw,15px)] font-extrabold text-[#f5f5f0]">
              {p.state === "done" ? "CLOSED · BACK TOMORROW" : "CLOSED · PREPARING"}
            </span>
          )}
        </div>
      </div>

      {p.soldOut && (
        <div style={{ ...at(228, 150), transform: "rotate(-8deg)" }} className="hz-pop rounded-md bg-pink px-2.5 py-1.5 text-base font-extrabold text-on-accent">
          SOLD OUT
        </div>
      )}

      {p.walkers?.map((w) => (
        <div key={w.key} className="hz-walker" style={{ ...at(w.left, 290), width: `${(28 / W) * 100}%`, opacity: w.opacity ?? 1 }} aria-hidden="true">
          <div className={w.bob ? "hz-bob" : ""}>
            <Walker look={w.look} width={28} />
          </div>
          {w.tag && (
            <span className="absolute -left-3 -top-5 whitespace-nowrap rounded-md bg-[#0e0e10] px-1.5 py-0.5 text-[10px] font-extrabold text-lime">{w.tag}</span>
          )}
        </div>
      ))}

      {p.bubble && (
        <div style={at(150, 214, 220)} className="hz-pop rounded-xl bg-[#f5f5f0] px-2.5 py-2 text-xs font-bold leading-snug text-[#0e0e10]">
          {p.bubble}
          <span className="absolute -bottom-2 left-16 h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-[#f5f5f0]" />
        </div>
      )}
    </div>
  );
}

function Pot({ steam, second }: { steam?: boolean; second?: boolean }) {
  return (
    <div className="relative -mt-[26px] h-[30px] w-11 shrink-0">
      <svg viewBox="0 0 44 30" className="block h-full w-full">
        <ellipse cx="22" cy="8" rx="18" ry="5" fill="#555" />
        <rect x="4" y="8" width="36" height="20" rx="5" fill={P.steel} />
        <rect x="0" y="12" width="6" height="4" rx="2" fill={P.steel} />
        <rect x="38" y="12" width="6" height="4" rx="2" fill={P.steel} />
      </svg>
      {steam && (
        <svg viewBox="0 0 44 20" className="absolute left-0 top-[-18px] h-5 w-11" overflow="visible">
          <path className={second ? "hz-steam2" : "hz-steam"} d="M16 18Q12 12 16 6Q20 0 16 -4" fill="none" stroke={P.cream} strokeWidth="2.4" strokeLinecap="round" />
          <path className={second ? "hz-steam" : "hz-steam2"} d="M28 18Q24 12 28 6Q32 0 28 -4" fill="none" stroke={P.cream} strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
