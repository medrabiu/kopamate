"use client";

import { BriefcaseIcon, LockIcon, MedalIcon, TrophyIcon } from "./icons";
import { useToast } from "./Toast";

const ITEMS = [
  { title: "Contests", text: "Compete with corpers nationwide", Icon: TrophyIcon },
  { title: "Awards", text: "Vote for the best in your state", Icon: MedalIcon },
  { title: "Opportunities", text: "Jobs and gigs for corpers", Icon: BriefcaseIcon },
];

/** "Coming soon" cards. `grid` = three small tiles (landing), `list` = rows with descriptions (home). */
export default function ComingSoon({ layout }: { layout: "grid" | "list" }) {
  const [toast, show] = useToast();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="h-display text-xl">Coming soon</h2>
      {layout === "grid" ? (
        <div className="grid grid-cols-3 gap-2.5">
          {ITEMS.map(({ title }) => (
            <button
              key={title}
              type="button"
              onClick={() => show(`${title} is coming soon`)}
              className="flex flex-col gap-2.5 rounded-[18px] bg-surface px-3 py-3.5 text-left"
            >
              <LockIcon size={20} className="text-muted" />
              <span className="text-sm font-medium">{title}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {ITEMS.map(({ title, text, Icon }) => (
            <button
              key={title}
              type="button"
              onClick={() => show(`${title} is coming soon`)}
              className="flex items-center gap-3.5 rounded-[18px] bg-surface p-4 text-left"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-surface-2 text-pink">
                <Icon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{title}</span>
                <span className="block text-[13px] text-muted">{text}</span>
              </span>
              <LockIcon size={18} className="text-faint" />
            </button>
          ))}
        </div>
      )}
      {toast}
    </section>
  );
}
