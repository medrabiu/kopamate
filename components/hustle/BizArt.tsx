import type { BizIcon } from "@/lib/hustle/types";

/** Logo glyphs, drawn on a 24×24 grid with the current colour. */
const GLYPHS: Record<BizIcon, React.ReactNode> = {
  pot: <path d="M4 10h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6zM2 10h20M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2" />,
  scissors: <path d="M6 9a3 3 0 1 0 0-.01M6 15a3 3 0 1 0 0 .01M8.5 10.5 20 4M8.5 13.5 20 20" />,
  shirt: <path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z" />,
  phone: <path d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  leaf: <path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15zM5 19l8-8" />,
  egg: <path d="M12 3c4 0 7 6 7 11a7 7 0 0 1-14 0c0-5 3-11 7-11z" />,
  truck: <path d="M2 6h11v10H2zM13 10h4l3 3v3h-7M6 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01" />,
  wrench: <path d="M14 7a4 4 0 0 0 5 5l-8 8a2 2 0 0 1-3-3l8-8a4 4 0 0 1-2-2zM14 7l3-3" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  drop: <path d="M12 3s7 7 7 12a7 7 0 0 1-14 0c0-5 7-12 7-12z" />,
  cart: <path d="M3 4h2l2 11h11l2-8H6M9 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01" />,
};

export function BizGlyph({ icon, size = 22 }: { icon: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPHS[icon as BizIcon] ?? GLYPHS.star}
    </svg>
  );
}

/** The business logo: its icon on its colour. */
export function BizLogo({ icon, color, size = 48, ring = false }: { icon: string; color: string; size?: number; ring?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center text-on-accent ${ring ? "border-[3px] border-bg" : ""}`}
      style={{ width: size, height: size, borderRadius: size * 0.28, background: color }}
      aria-hidden="true"
    >
      <BizGlyph icon={icon} size={Math.round(size * 0.5)} />
    </span>
  );
}

/** A simple shopfront banner in the business colour: awning, window and door. SVG only, so it's tiny. */
export function Shopfront({ color, category, height = 84 }: { color: string; category: string; height?: number }) {
  const stripes = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg viewBox="0 0 360 84" width="100%" height={height} preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="block">
      <rect width="360" height="84" fill={color} />
      <rect y="60" width="360" height="24" fill="#000" opacity="0.18" />
      {/* awning */}
      {stripes.map((i) => (
        <path key={i} d={`M${20 + i * 24} 14h24v18a12 12 0 0 1-24 0z`} fill={i % 2 ? "#fff" : "#000"} opacity={i % 2 ? 0.55 : 0.2} />
      ))}
      {/* window and door */}
      <rect x="34" y="40" width="96" height="20" rx="3" fill="#fff" opacity="0.6" />
      <rect x="150" y="38" width="30" height="22" rx="3" fill="#000" opacity="0.3" />
      {category === "supply" ? (
        <g opacity="0.45" fill="#000">
          <rect x="250" y="40" width="22" height="20" />
          <rect x="276" y="40" width="22" height="20" />
          <rect x="263" y="20" width="22" height="20" />
        </g>
      ) : category === "food" ? (
        <circle cx="290" cy="30" r="14" fill="#fff" opacity="0.5" />
      ) : (
        <path d="M262 60V36h56v24" fill="none" stroke="#000" strokeWidth="4" opacity="0.35" />
      )}
    </svg>
  );
}
