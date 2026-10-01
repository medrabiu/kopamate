import { BadgeGlyph } from "./BadgeIcon";
import { LockIcon } from "./icons";
import { badgeFill, type BadgeInfo } from "@/lib/badge-meta";

type Props = {
  badge: Pick<BadgeInfo, "name" | "icon" | "color">;
  /** Not earned yet: greyed out with a lock. */
  locked?: boolean;
  onClick?: () => void;
};

/** A badge as a coloured pill: icon + name. Becomes a button when `onClick` is given. */
export default function BadgeChip({ badge, locked, onClick }: Props) {
  const cls = `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full pl-2 pr-3 text-[13px] font-bold ${
    locked ? "border border-dashed border-line bg-surface-2 text-muted" : "text-on-accent"
  }`;
  const style = locked ? undefined : { background: badgeFill(badge.color) };
  const body = (
    <>
      {locked ? <LockIcon size={14} strokeWidth={2.4} /> : <BadgeGlyph icon={badge.icon} size={15} />}
      {badge.name}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls} style={style} aria-label={`${badge.name}${locked ? ", not earned yet" : ""}`}>
      {body}
    </button>
  ) : (
    <span className={cls} style={style}>
      {body}
    </span>
  );
}
