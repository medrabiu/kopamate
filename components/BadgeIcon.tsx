import { CheckIcon, ClockIcon, CrownIcon, EyeIcon, FlameIcon, LinkIcon, TrophyIcon } from "./icons";
import { badgeFill, type BadgeInfo } from "@/lib/badge-meta";

const GLYPHS: Record<string, typeof CheckIcon> = {
  clock: ClockIcon,
  check: CheckIcon,
  link: LinkIcon,
  eye: EyeIcon,
  crown: CrownIcon,
  flame: FlameIcon,
  trophy: TrophyIcon,
};

export function BadgeGlyph({ icon, size }: { icon: string; size: number }) {
  const Glyph = GLYPHS[icon] ?? CheckIcon;
  return <Glyph size={size} strokeWidth={2.6} />;
}

/** A user's top badge as a small coloured circle, shown next to their nickname in lists. */
export default function BadgeIcon({ badge, size = 16 }: { badge: Pick<BadgeInfo, "name" | "icon" | "color"> | null | undefined; size?: number }) {
  if (!badge) return null;
  return (
    <span
      role="img"
      aria-label={badge.name}
      title={badge.name}
      className="inline-flex shrink-0 items-center justify-center rounded-full align-middle text-on-accent"
      style={{ width: size, height: size, background: badgeFill(badge.color) }}
    >
      <BadgeGlyph icon={badge.icon} size={Math.round(size * 0.66)} />
    </span>
  );
}
