/**
 * Landing page hero: three corpers at a camp social night, one holding up their position.
 * Inline SVG rendered on the server, so it arrives with the HTML (no image request, ~1.5 KB gzipped).
 * Ink and background use theme classes (SVG attributes can't read CSS variables); accents stay fixed.
 * No NYSC logo, crest or official branding.
 */

const LIME = "#C6F432";
const PINK = "#FF4FA3";
const AMBER = "#FFB547";
const VIOLET = "#8B7BFF";
const TEAL = "#4FD1C5";
const KHAKI = "#C9B27C";
const KHAKI_DARK = "#A8925E";

function Corper({
  x,
  skin,
  cap,
  children,
}: {
  x: number;
  skin: string;
  cap: string;
  children?: React.ReactNode;
}) {
  return (
    <g transform={`translate(${x} 0)`}>
      {/* Body in a khaki jacket */}
      <path d="M-34 180v-34a24 24 0 0 1 24-24h20a24 24 0 0 1 24 24v34Z" fill={KHAKI} />
      <path d="M-10 122 0 138l10-16" fill="none" stroke={KHAKI_DARK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M0 138v42" stroke={KHAKI_DARK} strokeWidth="2" />
      <rect x="8" y="148" width="12" height="9" rx="2" fill={KHAKI_DARK} />
      {/* Head and cap */}
      <rect x="-6" y="106" width="12" height="14" rx="4" fill={skin} />
      <circle cx="0" cy="92" r="19" fill={skin} />
      <path d="M-20 88a20 20 0 0 1 40 0Z" fill={cap} />
      <path d="M14 88h14a3 3 0 0 1 0 6H14Z" fill={cap} />
      {/* Smile */}
      <circle cx="-6" cy="94" r="2" className="fill-bg" />
      <circle cx="6" cy="94" r="2" className="fill-bg" />
      <path d="M-6 101q6 5 12 0" fill="none" className="stroke-bg" strokeWidth="2" strokeLinecap="round" />
      {children}
    </g>
  );
}

const Sparkle = ({ x, y, s = 1, c = LIME }: { x: number; y: number; s?: number; c?: string }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0-7 1.8-1.8 7 0 1.8 1.8 0 7-1.8 1.8-7 0-1.8-1.8Z" fill={c} />
);

export default function HeroArt() {
  const bulbs = [LIME, PINK, AMBER, TEAL, VIOLET];
  return (
    <svg
      viewBox="0 0 440 180"
      role="img"
      aria-label="Three corpers in khaki celebrating at a camp social night"
      className="block h-auto w-full overflow-hidden rounded-3xl"
    >
      <rect width="440" height="180" className="fill-surface" />
      <circle cx="380" cy="30" r="70" fill={PINK} opacity="0.14" />
      <circle cx="40" cy="170" r="60" fill={LIME} opacity="0.1" />
      <circle cx="220" cy="120" r="80" fill={VIOLET} opacity="0.1" />

      {/* String lights */}
      <path d="M0 8q110 30 220 8t220 4" fill="none" className="stroke-line" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => {
        // Points along the two quadratic curves of the wire above, with bulbs hanging just below.
        const t = ((i % 6) + 0.5) / 6;
        const [p0, c, p1] = i < 6 ? [[0, 8], [110, 38], [220, 16]] : [[220, 16], [330, -6], [440, 20]];
        const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t ** 2 * p1[0];
        const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t ** 2 * p1[1];
        return <circle key={i} cx={x.toFixed(1)} cy={(y + 6).toFixed(1)} r="4.5" fill={bulbs[i % bulbs.length]} />;
      })}

      {/* Left corper: waving */}
      <Corper x={110} skin="#8D5524" cap={PINK}>
        <path d="M-30 134q-22-18-18-44" fill="none" stroke={KHAKI} strokeWidth="12" strokeLinecap="round" />
        <circle cx="-48" cy="86" r="7" fill="#8D5524" />
      </Corper>

      {/* Right corper: speech bubble with a heart */}
      <Corper x={330} skin="#A0673D" cap={TEAL}>
        <g transform="translate(24 44)">
          <path d="M0 0h52a10 10 0 0 1 10 10v22a10 10 0 0 1-10 10H18l-10 10v-10H0a10 10 0 0 1-10-10V10A10 10 0 0 1 0 0Z" fill={VIOLET} />
          <path d="M16 18a6 6 0 0 1 10 0 6 6 0 0 1 10 0c0 7-10 12-10 12s-10-5-10-12Z" fill={PINK} />
        </g>
      </Corper>

      {/* Middle corper: holding up their position */}
      <Corper x={220} skin="#6B3E26" cap={LIME}>
        <path d="M24 134q20-20 16-50" fill="none" stroke={KHAKI} strokeWidth="12" strokeLinecap="round" />
        <g transform="translate(22 24) rotate(8)">
          <rect x="0" y="0" width="40" height="66" rx="8" className="fill-ink" />
          <rect x="4" y="6" width="32" height="52" rx="4" fill={LIME} />
          <text x="20" y="38" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0E0E10" fontFamily="system-ui, sans-serif">
            #1
          </text>
          <path d="M14 46h12" stroke="#0E0E10" strokeWidth="2.5" strokeLinecap="round" opacity="0.4" />
        </g>
        <circle cx="42" cy="86" r="7" fill="#6B3E26" />
      </Corper>

      {/* Confetti */}
      <Sparkle x={40} y={70} s={1.3} />
      <Sparkle x={400} y={98} s={1.1} c={PINK} />
      <Sparkle x={292} y={72} s={0.8} c={AMBER} />
      <Sparkle x={160} y={56} s={0.7} c={TEAL} />
      <rect x="66" y="112" width="8" height="4" rx="1" fill={AMBER} transform="rotate(30 70 114)" />
      <rect x="378" y="140" width="8" height="4" rx="1" fill={LIME} transform="rotate(-25 382 142)" />
      <rect x="176" y="40" width="7" height="4" rx="1" fill={PINK} transform="rotate(50 180 42)" />
    </svg>
  );
}
