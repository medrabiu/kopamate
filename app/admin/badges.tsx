type Flags = {
  is_flagged: boolean;
  is_banned: boolean;
  is_seed: boolean;
  completed_at: Date | null;
  verification_status: string;
};

/** Small status labels shown next to a user's name in the admin. */
export function StatusBadges({ user: u }: { user: Flags }) {
  const badges: [string, string][] = [];
  if (u.verification_status === "verified") badges.push(["Verified", "bg-lime font-bold text-on-accent"]);
  if (u.verification_status === "pending") badges.push(["Pending check", "bg-surface-2"]);
  if (u.is_flagged) badges.push(["Flagged", "bg-pink font-bold text-on-accent"]);
  if (u.is_banned) badges.push(["Banned", "bg-ink font-bold text-bg"]);
  if (u.is_seed) badges.push(["Seed", "bg-surface-2"]);
  if (!u.completed_at) badges.push(["Unfinished", "bg-surface-2"]);
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {badges.map(([label, cls]) => (
        <span key={label} className={`rounded px-1.5 text-xs ${cls}`}>
          {label}
        </span>
      ))}
    </div>
  );
}
