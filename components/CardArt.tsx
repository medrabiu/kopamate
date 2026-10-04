/**
 * Small illustrations for the Explore tiles on Home and the "coming soon" sheets, in the Social Night palette.
 * Inline SVG: no extra network requests, sharp on every screen, and ships inside the
 * component's JS chunk (hashed and cached for a year). Ink and background use theme classes
 * (SVG attributes can't read CSS variables), so they follow light/dark mode; accents stay fixed.
 */

const LIME = "#C6F432";
const PINK = "#FF4FA3";
const AMBER = "#FFB547";
const VIOLET = "#8B7BFF";
const TEAL = "#4FD1C5";
const KHAKI = "#C9B27C";

export type ArtKey =
  | "khaki"
  | "talent"
  | "manowar"
  | "cookoff"
  | "cds"
  | "corper-month"
  | "platoon"
  | "comedian"
  | "mvp"
  | "stylish"
  | "jobs";

function Frame({ glow, children }: { glow: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 220 110" className="block h-full w-full" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="220" height="110" className="fill-surface-2" />
      <circle cx="188" cy="18" r="46" fill={glow} opacity="0.18" />
      <circle cx="28" cy="102" r="34" fill={glow} opacity="0.12" />
      {children}
    </svg>
  );
}

const Sparkle = ({ x, y, s = 1, c = LIME }: { x: number; y: number; s?: number; c?: string }) => (
  <path
    transform={`translate(${x} ${y}) scale(${s})`}
    d="M0-7 1.8-1.8 7 0 1.8 1.8 0 7-1.8 1.8-7 0-1.8-1.8Z"
    fill={c}
  />
);

const ART: Record<ArtKey, () => React.ReactElement> = {
  khaki: () => (
    <Frame glow={PINK}>
      {/* Khaki jacket on a hanger */}
      <path d="M110 22v-6a6 6 0 1 1 6 6" fill="none" className="stroke-ink" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M110 22 76 38h68Z" fill="none" className="stroke-ink" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M84 36 68 48l8 18 8-4v38h52V62l8 4 8-18-16-12-14 6h-24Z" fill={KHAKI} />
      <path d="M96 42 110 60l14-18" fill="none" className="stroke-ink" strokeWidth="2.5" strokeLinejoin="round" opacity="0.55" />
      <path d="M110 60v38" className="stroke-ink" strokeWidth="2" opacity="0.4" />
      <rect x="116" y="70" width="12" height="9" rx="1.5" className="fill-ink" opacity="0.25" />
      <circle cx="104" cy="70" r="1.8" className="fill-ink" opacity="0.5" />
      <circle cx="104" cy="82" r="1.8" className="fill-ink" opacity="0.5" />
      <Sparkle x={58} y={34} s={1.2} />
      <Sparkle x={160} y={78} c={PINK} />
      <Sparkle x={166} y={40} s={0.7} />
    </Frame>
  ),
  talent: () => (
    <Frame glow={VIOLET}>
      {/* Microphone and music notes */}
      <rect x="96" y="18" width="28" height="44" rx="14" fill={PINK} />
      <path d="M100 30h20M100 38h20M100 46h20" className="stroke-ink" strokeWidth="2" opacity="0.3" />
      <path d="M88 50a22 22 0 0 0 44 0" fill="none" className="stroke-ink" strokeWidth="3" strokeLinecap="round" />
      <path d="M110 72v18M96 92h28" className="stroke-ink" strokeWidth="3" strokeLinecap="round" />
      <path d="M58 46v-18l16-4v18" fill="none" stroke={LIME} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="54" cy="47" r="5" fill={LIME} />
      <circle cx="70" cy="43" r="5" fill={LIME} />
      <path d="M160 62V40" stroke={AMBER} strokeWidth="3" />
      <circle cx="155" cy="63" r="6" fill={AMBER} />
      <path d="M160 40q10 2 10 12" fill="none" stroke={AMBER} strokeWidth="3" strokeLinecap="round" />
      <Sparkle x={170} y={24} s={0.8} c={LIME} />
    </Frame>
  ),
  manowar: () => (
    <Frame glow={LIME}>
      {/* Cargo net obstacle with a flag at the top */}
      <path d="M60 100 88 26h44l28 74" fill="none" className="stroke-ink" strokeWidth="3" strokeLinejoin="round" />
      <g stroke={AMBER} strokeWidth="2.5" opacity="0.9">
        <path d="M70 74h80M78 52h64M84 36h52" />
        <path d="M96 26 84 100M110 26v74M124 26l12 74" />
      </g>
      <path d="M110 26V8" className="stroke-ink" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M110 9h20l-5 6 5 6h-20Z" fill={LIME} />
      <circle cx="132" cy="60" r="6" fill={PINK} />
      <path d="M132 66v12l-6 10M132 72l8-6M132 78l6 8" stroke={PINK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </Frame>
  ),
  cookoff: () => (
    <Frame glow={AMBER}>
      {/* Pot on a fire with steam */}
      <path d="M92 20q-6 8 0 16t0 16M110 16q-6 8 0 16t0 16M128 20q-6 8 0 16t0 16" fill="none" className="stroke-ink" strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
      <path d="M74 56h72v18a20 20 0 0 1-20 20h-32a20 20 0 0 1-20-20Z" fill={PINK} />
      <rect x="70" y="50" width="80" height="8" rx="4" className="fill-ink" />
      <path d="M66 66h-6M154 66h6" className="stroke-ink" strokeWidth="4" strokeLinecap="round" />
      <path d="M92 104q-4-8 4-12 0 6 6 6-2 6-10 6ZM118 104q-4-8 4-12 0 6 6 6-2 6-10 6Z" fill={AMBER} />
      <circle cx="168" cy="82" r="12" fill={LIME} />
      <circle cx="164" cy="79" r="2.5" className="fill-ink" opacity="0.3" />
      <circle cx="171" cy="85" r="2" className="fill-ink" opacity="0.3" />
    </Frame>
  ),
  cds: () => (
    <Frame glow={TEAL}>
      {/* Community building with a growing plant */}
      <path d="M62 54 94 30l32 24v44H62Z" fill={TEAL} />
      <rect x="86" y="72" width="16" height="26" rx="2" className="fill-ink" opacity="0.8" />
      <rect x="70" y="60" width="10" height="10" rx="1.5" className="fill-surface-2" />
      <rect x="108" y="60" width="10" height="10" rx="1.5" className="fill-surface-2" />
      <path d="M150 98V66" className="stroke-ink" strokeWidth="3" strokeLinecap="round" />
      <path d="M150 76q-18-2-18-18 18 0 18 18ZM150 70q16-2 16-18-16 0-16 18Z" fill={LIME} />
      <path d="M40 98h140" className="stroke-ink" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      <path d="M160 34a6 6 0 0 1 10 0 6 6 0 0 1 10 0c0 7-10 12-10 12s-10-5-10-12Z" fill={PINK} />
    </Frame>
  ),
  "corper-month": () => (
    <Frame glow={LIME}>
      {/* Medal with a big star */}
      <path d="M92 10h14l10 30h-14ZM128 10h-14l-10 30h14Z" fill={PINK} />
      <circle cx="110" cy="66" r="32" fill={LIME} />
      <circle cx="110" cy="66" r="24" fill="none" className="stroke-ink" strokeWidth="2" opacity="0.25" />
      <path d="m110 50 5 10.5 11.5 1.5-8.5 8 2 11.5-10-5.5-10 5.5 2-11.5-8.5-8 11.5-1.5Z" className="fill-ink" />
      <Sparkle x={60} y={40} s={1.1} c={AMBER} />
      <Sparkle x={162} y={84} c={PINK} />
      <Sparkle x={168} y={36} s={0.7} c={LIME} />
    </Frame>
  ),
  platoon: () => (
    <Frame glow={VIOLET}>
      {/* Group of corpers under a platoon flag */}
      <path d="M150 16v54" className="stroke-ink" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M150 18h34l-7 9 7 9h-34Z" fill={PINK} />
      <text x="162" y="32" fontSize="12" fontWeight="800" className="fill-ink" fontFamily="system-ui, sans-serif">
        5
      </text>
      {[
        [58, LIME],
        [84, AMBER],
        [110, TEAL],
        [136, VIOLET],
      ].map(([x, c], i) => (
        <g key={i}>
          <circle cx={x as number} cy={62 - (i % 2) * 6} r="11" fill={c as string} />
          <path d={`M${(x as number) - 16} 104a16 20 0 0 1 32 0Z`} transform={`translate(0 ${-(i % 2) * 6})`} fill={c as string} opacity="0.85" />
        </g>
      ))}
    </Frame>
  ),
  comedian: () => (
    <Frame glow={AMBER}>
      {/* Laughing face */}
      <circle cx="110" cy="56" r="36" fill={AMBER} />
      <path d="M92 48q6-8 12 0M116 48q6-8 12 0" fill="none" className="stroke-ink" strokeWidth="3" strokeLinecap="round" />
      <path d="M90 62h40a20 20 0 0 1-40 0Z" className="fill-ink" />
      <path d="M100 74a10 6 0 0 1 20 0" fill={PINK} />
      <path d="M82 54q-6 4-4 10M138 54q6 4 4 10" fill="none" stroke={TEAL} strokeWidth="3" strokeLinecap="round" />
      <text x="152" y="34" fontSize="16" fontWeight="800" fill={PINK} fontFamily="system-ui, sans-serif">
        HA
      </text>
      <text x="40" y="96" fontSize="13" fontWeight="800" fill={LIME} fontFamily="system-ui, sans-serif">
        HA
      </text>
    </Frame>
  ),
  mvp: () => (
    <Frame glow={PINK}>
      {/* Disco ball with spotlights */}
      <path d="M40 110 96 44M180 110l-56-66" stroke={LIME} strokeWidth="14" opacity="0.18" />
      <path d="M110 6v14" className="stroke-ink" strokeWidth="2.5" />
      <circle cx="110" cy="46" r="26" fill={VIOLET} />
      <g className="stroke-ink" strokeWidth="1.5" opacity="0.35" fill="none">
        <path d="M84 46h52M88 34h44M88 58h44M110 20v52" />
        <ellipse cx="110" cy="46" rx="12" ry="26" />
      </g>
      <rect x="98" y="34" width="8" height="8" fill={LIME} opacity="0.9" />
      <rect x="116" y="50" width="8" height="8" fill={PINK} opacity="0.9" />
      <text x="86" y="100" fontSize="18" fontWeight="800" className="fill-ink" fontFamily="system-ui, sans-serif">
        MVP
      </text>
      <Sparkle x={52} y={30} c={LIME} />
      <Sparkle x={170} y={40} s={1.1} c={PINK} />
      <Sparkle x={158} y={86} s={0.7} c={AMBER} />
    </Frame>
  ),
  stylish: () => (
    <Frame glow={LIME}>
      {/* Crown over sunglasses */}
      <path d="m84 42 8-22 18 14 18-14 8 22Z" fill={AMBER} />
      <circle cx="92" cy="18" r="4" fill={AMBER} />
      <circle cx="110" cy="30" r="4" fill={PINK} />
      <circle cx="128" cy="18" r="4" fill={AMBER} />
      <path d="M60 58h100" className="stroke-ink" strokeWidth="4" strokeLinecap="round" />
      <path
        d="M66 58h36v8a16 16 0 0 1-16 16h-4a16 16 0 0 1-16-16ZM118 58h36v8a16 16 0 0 1-16 16h-4a16 16 0 0 1-16-16Z"
        fill="#17171A"
        className="stroke-ink"
        strokeWidth="2.5"
      />
      <path d="M74 64l10 10M126 64l10 10" stroke={LIME} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <Sparkle x={170} y={92} c={PINK} />
      <Sparkle x={48} y={90} s={0.8} c={LIME} />
    </Frame>
  ),
  jobs: () => (
    <Frame glow={LIME}>
      {/* Briefcase with an upward arrow */}
      <rect x="68" y="42" width="84" height="56" rx="8" fill={LIME} />
      <path d="M96 42v-8a6 6 0 0 1 6-6h16a6 6 0 0 1 6 6v8" fill="none" className="stroke-ink" strokeWidth="3.5" />
      <path d="M68 64h84" className="stroke-ink" strokeWidth="3" opacity="0.4" />
      <rect x="104" y="58" width="12" height="12" rx="2" className="fill-ink" />
      <path d="M168 76V30m-12 12 12-12 12 12" fill="none" stroke={PINK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  ),
};

export default function CardArt({ art }: { art: ArtKey }) {
  const Art = ART[art];
  return <Art />;
}
