/** Green for verified corpers; the same in light and dark themes, with a white tick for contrast. */
const GREEN = "#00A86B";

/**
 * The verified check shown right after a verified corper's username, like X's blue check.
 * Verified means an admin checked their NYSC ID (verification_status 'verified' and not flagged).
 */
export default function VerifiedBadge({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      role="img"
      aria-label="Verified corper"
      width={size}
      height={size}
      viewBox="-1 -1 26 26"
      className={`inline-block shrink-0 align-[-0.15em] ${className}`}
    >
      <title>Verified corper</title>
      <path
        fill={GREEN}
        d="M12 2.4Q15.87 0.09 17.64 4.23Q22.14 4.64 21.13 9.03Q24.53 12 21.13 14.97Q22.14 19.36 17.64 19.77Q15.87 23.91 12 21.6Q8.13 23.91 6.36 19.77Q1.86 19.36 2.87 14.97Q-0.53 12 2.87 9.03Q1.86 4.64 6.36 4.23Q8.13 0.09 12 2.4Z"
      />
      <path d="M7.6 12.3l3 3 5.8-6.2" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
