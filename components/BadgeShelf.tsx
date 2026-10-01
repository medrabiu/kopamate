"use client";

import { useState } from "react";
import BadgeChip from "./BadgeChip";
import { BadgeGlyph } from "./BadgeIcon";
import Sheet from "./Sheet";
import { BADGE_HOW_TO, badgeFill, type BadgeInfo } from "@/lib/badge-meta";

export type ShelfBadge = BadgeInfo & { qualifies_for_rewards: boolean; awarded_at: string | null };

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso));

/**
 * A row of badge chips. Earned badges come first; locked ones are greyed out.
 * Tapping a chip opens a sheet with the name, description and date earned (or how to earn it).
 */
export default function BadgeShelf({ badges, showLocked = true }: { badges: ShelfBadge[]; showLocked?: boolean }) {
  const [open, setOpen] = useState<ShelfBadge | null>(null);
  const shown = showLocked ? badges : badges.filter((b) => b.awarded_at);
  const sorted = [...shown].sort((a, b) => Number(Boolean(b.awarded_at)) - Number(Boolean(a.awarded_at)));

  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {sorted.map((b) => (
          <li key={b.slug}>
            <BadgeChip badge={b} locked={!b.awarded_at} onClick={() => setOpen(b)} />
          </li>
        ))}
      </ul>
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.name ?? "Badge"}>
        {open && (
          <div className="flex flex-col items-start gap-3">
            <span
              className={`flex size-14 items-center justify-center rounded-full ${open.awarded_at ? "text-on-accent" : "bg-surface-2 text-muted"}`}
              style={open.awarded_at ? { background: badgeFill(open.color) } : undefined}
            >
              <BadgeGlyph icon={open.icon} size={28} />
            </span>
            <p className="text-[15px] leading-normal">{open.description}</p>
            {open.awarded_at ? (
              <p className="text-sm text-muted">Earned {formatDate(open.awarded_at)}</p>
            ) : (
              <p className="text-sm text-muted">
                <span className="font-bold text-ink">How to earn it: </span>
                {BADGE_HOW_TO[open.slug] ?? open.description}
              </p>
            )}
            {open.qualifies_for_rewards && (
              <span className="rounded-full bg-pink px-2.5 py-1 text-xs font-bold text-on-accent">Qualifies for rewards</span>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
