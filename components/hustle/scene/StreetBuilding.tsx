import { BizGlyph } from "../BizArt";
import { P } from "./Person";
import type { Family } from "./ShopStage";

/** Short sign text that fits a 120px sign. */
function signText(name: string, max = 16) {
  const t = name.toUpperCase();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function Sign({ name, x = 20, w = 120, fill = P.dark, ink = P.lime }: { name: string; x?: number; w?: number; fill?: string; ink?: string }) {
  const text = signText(name);
  return (
    <g>
      <rect x={x} y="4" width={w} height="26" rx="6" fill={fill} />
      <text x={x + w / 2} y="22" textAnchor="middle" fontWeight="800" fontSize={Math.min(12, (w / text.length) * 1.6)} fill={ink} style={{ fontFamily: "var(--font-display)" }}>
        {text}
      </text>
    </g>
  );
}

/**
 * One business on the market street, about 160×170: its own front for buka, barber, salon, laundry, POS
 * (umbrella stand) and crop farm (produce stall); every other type gets a generic front in its colour.
 */
export default function StreetBuilding({ family, name, color, icon, open }: { family: Family; name: string; color: string; icon: string; open: boolean }) {
  const light = <circle cx="146" cy="40" r="5" fill={open ? P.lime : "#5a5a56"} stroke={P.dark} strokeWidth="1.5" />;
  switch (family) {
    case "barber":
      return (
        <svg viewBox="0 0 160 172" className="block h-auto w-full" aria-hidden="true">
          <rect x="8" y="30" width="144" height="142" fill="#dfe9f5" />
          <Sign name={name} fill="#123049" ink={P.cream} />
          <rect x="22" y="56" width="80" height="96" fill="#2b3a4a" />
          <circle cx="62" cy="96" r="22" fill="#9fc4e6" />
          <rect x="118" y="52" width="14" height="80" rx="7" fill={P.cream} />
          <path d="M118 62L132 54M118 78L132 70M118 94L132 86M118 110L132 102M118 126L132 118" stroke="#e2542b" strokeWidth="5" />
          <rect x="22" y="150" width="80" height="22" fill={open ? "#3a4a5a" : "#7d7d78"} />
          {light}
        </svg>
      );
    case "salon":
      return (
        <svg viewBox="0 0 160 172" className="block h-auto w-full" aria-hidden="true">
          <rect x="8" y="30" width="144" height="142" fill="#ffd6ea" />
          <Sign name={name} fill={P.pink} ink={P.dark} />
          <rect x="22" y="50" width="116" height="84" fill="#4a1a3a" />
          <ellipse cx="80" cy="90" rx="20" ry="26" fill="#ff8fc4" />
          <path d="M60 80Q80 50 100 80" fill="none" stroke={P.dark} strokeWidth="6" />
          <rect x="22" y="142" width="116" height="30" fill={open ? "#6a2a5a" : "#7d7d78"} />
          {light}
        </svg>
      );
    case "laundry":
      return (
        <svg viewBox="0 0 160 172" className="block h-auto w-full" aria-hidden="true">
          <rect x="8" y="30" width="144" height="142" fill="#e6e0ff" />
          <Sign name={name} fill="#2a1f4a" ink="#b9a6ff" />
          {[26, 86].map((x) => (
            <g key={x}>
              <rect x={x} y="56" width="48" height="60" rx="6" fill={P.cream} />
              <circle cx={x + 24} cy="90" r="16" fill="#7fc4ff" />
            </g>
          ))}
          <path d="M20 134H140" stroke="#5a5a66" strokeWidth="2" />
          {[30, 52, 74, 96, 118].map((x, i) => (
            <rect key={x} x={x} y="134" width="14" height="16" fill={[color, P.pink, P.lime, "#7fc4ff", P.yellow][i]} />
          ))}
          {light}
        </svg>
      );
    case "pos":
      return (
        <svg viewBox="0 0 160 172" className="block h-auto w-full" aria-hidden="true">
          <Sign name={name} />
          <path d="M20 70Q80 24 140 70Z" fill={color} />
          <path d="M20 70Q50 52 80 70Q110 52 140 70" fill="none" stroke={P.dark} strokeWidth="2" />
          <rect x="78" y="70" width="4" height="70" fill="#5a5a56" />
          <rect x="30" y="110" width="100" height="40" rx="4" fill="#123049" />
          <rect x="40" y="118" width="34" height="22" rx="3" fill={P.dark} />
          <rect x="44" y="122" width="26" height="8" fill="#7fc4ff" />
          <rect x="34" y="150" width="6" height="22" fill="#5a5a56" />
          <rect x="120" y="150" width="6" height="22" fill="#5a5a56" />
          <circle cx="146" cy="100" r="5" fill={open ? P.lime : "#5a5a56"} stroke={P.dark} strokeWidth="1.5" />
        </svg>
      );
    case "farm":
      return (
        <svg viewBox="0 0 160 172" className="block h-auto w-full" aria-hidden="true">
          <Sign name={name} fill="#1d3b1a" />
          <path d="M8 60L80 36L152 60Z" fill={color} />
          <rect x="14" y="60" width="4" height="90" fill={P.woodDark} />
          <rect x="142" y="60" width="4" height="90" fill={P.woodDark} />
          <rect x="18" y="120" width="124" height="30" rx="2" fill={P.wood} />
          {[30, 52, 74, 96, 118].map((x, i) => (
            <circle key={x} cx={x + 6} cy="114" r="8" fill={i % 2 ? "#e2542b" : P.lime} />
          ))}
          <rect x="18" y="150" width="124" height="22" fill={P.woodDark} opacity="0.4" />
          <circle cx="146" cy="76" r="5" fill={open ? P.lime : "#5a5a56"} stroke={P.dark} strokeWidth="1.5" />
        </svg>
      );
    case "buka":
      return (
        <svg viewBox="0 0 160 172" className="block h-auto w-full" aria-hidden="true">
          <rect x="8" y="30" width="144" height="142" fill={P.wall} />
          <Sign name={name} />
          <path d="M8 36H152V52H8Z" fill={color} />
          <path d="M8 36H26V52H8ZM44 36H62V52H44ZM80 36H98V52H80ZM116 36H134V52H116Z" fill={P.cream} />
          <rect x="22" y="62" width="116" height="80" fill={P.inside} />
          <rect x="22" y="128" width="116" height="14" fill={P.wood} />
          <ellipse cx="50" cy="122" rx="14" ry="4" fill="#555" />
          <rect x="38" y="122" width="24" height="8" fill={P.steel} />
          <rect x="22" y="142" width="116" height="30" fill={open ? "#5a2e18" : "#7d7d78"} />
          {light}
        </svg>
      );
    default:
      return (
        <div className="relative">
          <svg viewBox="0 0 160 172" className="block h-auto w-full" aria-hidden="true">
            <rect x="8" y="30" width="144" height="142" fill={P.wall} />
            <Sign name={name} />
            <path d="M8 36H152V54H8Z" fill={color} />
            <rect x="22" y="64" width="116" height="78" fill={P.inside} />
            <rect x="22" y="142" width="116" height="30" fill={open ? "#5a2e18" : "#7d7d78"} />
            {light}
          </svg>
          <span className="absolute left-1/2 top-[48%] flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl text-on-accent" style={{ background: color }} aria-hidden="true">
            <BizGlyph icon={icon} size={20} />
          </span>
        </div>
      );
  }
}
