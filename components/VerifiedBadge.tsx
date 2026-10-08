import { LogoMark } from "./Logo";

/** Green for verified corpers, gold for brands; the same in light and dark themes, with a white tick for contrast. */
const GREEN = "#00A86B";
const GOLD = "#E8B21B";

const SEAL =
  "M12 2.4Q15.87 0.09 17.64 4.23Q22.14 4.64 21.13 9.03Q24.53 12 21.13 14.97Q22.14 19.36 17.64 19.77Q15.87 23.91 12 21.6Q8.13 23.91 6.36 19.77Q1.86 19.36 2.87 14.97Q-0.53 12 2.87 9.03Q1.86 4.64 6.36 4.23Q8.13 0.09 12 2.4Z";

/**
 * The check shown right after a username, like X's. Green: a verified corper (an admin checked their NYSC ID).
 * Gold (`brand`): a brand or organisation marked by an admin.
 */
export default function VerifiedBadge({ size = 16, className = "", brand = false }: { size?: number; className?: string; brand?: boolean }) {
  const label = brand ? "Verified brand" : "Verified corper";
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox="-1 -1 26 26" className={`inline-block shrink-0 align-[-0.15em] ${className}`}>
      <title>{label}</title>
      <path fill={brand ? GOLD : GREEN} d={SEAL} />
      <path d="M7.6 12.3l3 3 5.8-6.2" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The small Kopamate logo shown after the check for Kopamate team members (like X's affiliate badges). */
export function TeamBadge({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <span role="img" aria-label="Kopamate team" title="Kopamate team" className={`inline-flex shrink-0 align-[-0.15em] ${className}`}>
      <LogoMark size={size} />
    </span>
  );
}

/**
 * Everything after a name: the gold check for brands, otherwise the green check for verified corpers, then the
 * Kopamate logo for team members. Renders nothing when none apply.
 */
export function NameBadges({ verified, brand, team, size = 16 }: { verified?: boolean; brand?: boolean; team?: boolean; size?: number }) {
  if (!verified && !brand && !team) return null;
  return (
    <>
      {(brand || verified) && <VerifiedBadge size={size} brand={brand} />}
      {team && <TeamBadge size={Math.round(size * 0.9)} />}
    </>
  );
}
