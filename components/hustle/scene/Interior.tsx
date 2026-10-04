import Link from "next/link";
import { ChevronLeft } from "@/components/icons";

/**
 * The frame for a shop interior: back wall, floor, a back button, and a scene drawn in a 390×400 box that
 * scales with the screen. Barber is the first; salon and laundry can reuse it with their own art and actors.
 */
export default function Interior({
  wall,
  floor,
  label,
  backHref = "/hustle/market",
  art,
  children,
}: {
  wall: string;
  floor: string;
  label: string;
  backHref?: string;
  /** Static SVG content, in 390×400 coordinates. */
  art: React.ReactNode;
  /** Overlays (people, tools), placed with `at()`. */
  children?: React.ReactNode;
}) {
  return (
    <div role="img" aria-label={label} className="relative w-full overflow-hidden" style={{ aspectRatio: "390 / 400", background: wall }}>
      <svg viewBox="0 0 390 400" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <rect x="0" y="300" width="390" height="100" fill={floor} />
        <path d="M0 300H390" stroke="rgba(0,0,0,.18)" strokeWidth="4" />
        {art}
      </svg>
      {children}
      <Link href={backHref} aria-label="Back to the street" className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white">
        <ChevronLeft size={20} />
      </Link>
    </div>
  );
}

/** Places an overlay in the interior's 390×400 coordinates. */
export const at = (x: number, y: number, w?: number, h?: number): React.CSSProperties => ({
  position: "absolute",
  left: `${(x / 390) * 100}%`,
  top: `${(y / 400) * 100}%`,
  ...(w !== undefined ? { width: `${(w / 390) * 100}%` } : {}),
  ...(h !== undefined ? { height: `${(h / 400) * 100}%` } : {}),
});
