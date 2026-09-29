/**
 * Shows how to photograph an ID card for verification: flat, well lit, all four corners in frame.
 * A generic card drawing (no NYSC design). Ink and background use theme classes; accents stay fixed.
 */
export default function IdCardGuide() {
  return (
    <div className="flex items-center gap-3.5">
      <svg viewBox="0 0 120 84" aria-hidden="true" className="h-[72px] w-auto shrink-0">
        {/* Camera frame corners */}
        <g fill="none" stroke="#C6F432" strokeWidth="3.5" strokeLinecap="round">
          <path d="M4 18V6a2 2 0 0 1 2-2h12M102 4h12a2 2 0 0 1 2 2v12M116 66v12a2 2 0 0 1-2 2h-12M18 80H6a2 2 0 0 1-2-2V66" />
        </g>
        {/* The card */}
        <rect x="16" y="16" width="88" height="52" rx="6" className="fill-surface-2 stroke-line" strokeWidth="1.5" />
        <rect x="16" y="16" width="88" height="11" rx="6" fill="#FF4FA3" />
        <rect x="16" y="22" width="88" height="5" fill="#FF4FA3" />
        <rect x="24" y="33" width="22" height="27" rx="3" fill="#FFB547" />
        <circle cx="35" cy="42" r="5" className="fill-surface-2" />
        <path d="M27 58a8 8 0 0 1 16 0Z" className="fill-surface-2" />
        <g className="stroke-faint" strokeWidth="3" strokeLinecap="round">
          <path d="M54 37h40M54 46h30M54 55h36" />
        </g>
      </svg>
      <ul className="flex flex-col gap-1 text-[13px] leading-snug text-muted">
        <li>Lay it flat on a table</li>
        <li>Use good light, no glare</li>
        <li>Keep all 4 corners in the photo</li>
      </ul>
    </div>
  );
}
