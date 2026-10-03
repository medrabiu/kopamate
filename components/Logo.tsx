/**
 * The Kopamate mark ("Rise"): a dark K on a lime tile, its arm rising into an arrow.
 * Plain SVG so it renders both in pages and inside ImageResponse (icons, share images).
 * `fullBleed` drops the rounded corners, for icons the platform masks itself (Apple, maskable).
 */
export function LogoMark({ size = 32, fullBleed = false, className }: { size?: number; fullBleed?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden="true">
      <rect width="100" height="100" rx={fullBleed ? 0 : 24} fill="#C6F432" />
      <g fill="none" stroke="#0E0E10" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round">
        <path d="M32 22V78" />
        <path d="M34 60L70 26" />
        <path d="M52 26H70V44" />
        <path d="M48 47L70 78" />
      </g>
    </svg>
  );
}
