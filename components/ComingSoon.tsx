"use client";

import { useState } from "react";
import CardArt, { type ArtKey } from "./CardArt";
import { BriefcaseIcon, LockIcon, MedalIcon, TrophyIcon } from "./icons";
import Sheet from "./Sheet";
import { useToast } from "./Toast";

const TILES = ["Contests", "Awards", "Opportunities"];

type Item = { title: string; text: string; art: ArtKey };

function sections(state: string | null) {
  return [
    {
      heading: "Contests",
      Icon: TrophyIcon,
      items: [
        { title: "Best Khaki Drip", text: "Show off your khaki style. Your state votes.", art: "khaki" },
        { title: "Camp Talent Showdown", text: "Sing, dance or make us laugh.", art: "talent" },
        { title: "Man O' War Challenge", text: "Post your best obstacle-course moment.", art: "manowar" },
        { title: "Mammy Market Cook-off", text: "Who makes the best camp meal?", art: "cookoff" },
        { title: "Best CDS Project", text: "Share your community project and win.", art: "cds" },
      ],
    },
    {
      heading: "Awards",
      Icon: MedalIcon,
      items: [
        { title: "Corper of the Month", text: "Voted by corpers in your state.", art: "corper-month" },
        { title: "Best Platoon", text: "Platoon pride, settled by votes.", art: "platoon" },
        { title: "Camp Comedian", text: "The funniest corper in camp.", art: "comedian" },
        { title: "Social Night MVP", text: "The star of social night.", art: "mvp" },
        { title: `Most Stylish in ${state || "your state"}`, text: "Your state picks its best dressed.", art: "stylish" },
      ],
    },
    {
      heading: "Opportunities",
      Icon: BriefcaseIcon,
      items: [
        { title: "Jobs from ex-corpers", text: "Openings shared by people who served before you.", art: "jobs" },
        { title: "Remote gigs", text: "Paid online work you can do during service.", art: "remote" },
        { title: "Retention at your PPA", text: "Tips and openings to get retained.", art: "retention" },
        { title: "Skills and SAED", text: "Training to start your own business.", art: "saed" },
        { title: "Scholarships and grants", text: "Funding for your next step.", art: "scholarships" },
      ],
    },
  ] satisfies { heading: string; Icon: typeof TrophyIcon; items: Item[] }[];
}

/**
 * "Coming soon".
 * `grid`: three small tiles (landing). `tiles`: three tiles in a card (home); each opens a sheet listing what's planned.
 */
export default function ComingSoon(props: { layout: "grid" } | { layout: "tiles"; state: string | null }) {
  const [toast, show] = useToast();
  const [open, setOpen] = useState<string | null>(null);

  if (props.layout === "grid") {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="h-display text-xl">Coming soon</h2>
        <div className="grid grid-cols-3 gap-2.5">
          {TILES.map((title) => (
            <button
              key={title}
              type="button"
              onClick={() => show(`${title} is coming soon`)}
              className="flex flex-col gap-2.5 rounded-[18px] border border-line px-3 py-3.5 text-left"
            >
              <LockIcon size={20} className="text-muted" />
              <span className="text-sm font-medium">{title}</span>
            </button>
          ))}
        </div>
        {toast}
      </section>
    );
  }

  const all = sections(props.state);
  const current = all.find((s) => s.heading === open);
  return (
    <section className="flex flex-col gap-3" aria-labelledby="soon-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="soon-title" className="h-display text-xl">
          Coming soon
        </h2>
        <span className="flex items-center gap-1 text-xs text-faint">
          <LockIcon size={12} strokeWidth={2.5} />
          Tap to see what&apos;s planned
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {all.map(({ heading, Icon, items }) => (
          <button
            key={heading}
            type="button"
            onClick={() => setOpen(heading)}
            className="flex flex-col gap-2 rounded-[18px] border border-line px-3 py-3.5 text-left"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-pink-ink">
              <Icon size={18} />
            </span>
            <span className="text-sm font-bold">{heading}</span>
            <span className="-mt-1.5 text-xs text-muted">{items.length} coming</span>
          </button>
        ))}
      </div>
      <Sheet open={current !== undefined} onClose={() => setOpen(null)} title={current ? `${current.heading} · coming soon` : "Coming soon"}>
        {current && (
          <ul className="flex flex-col gap-2.5">
            {current.items.map(({ title, text, art }) => (
              <li key={title} className="flex items-center gap-3">
                <span className="block size-16 shrink-0 overflow-hidden rounded-2xl">
                  <CardArt art={art} />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold leading-snug">{title}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </section>
  );
}
