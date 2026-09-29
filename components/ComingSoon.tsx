"use client";

import { BriefcaseIcon, LockIcon, MedalIcon, TrophyIcon } from "./icons";
import { useToast } from "./Toast";

const TILES = ["Contests", "Awards", "Opportunities"];

type Item = { title: string; text: string };

function sections(state: string | null) {
  return [
    {
      heading: "Contests",
      Icon: TrophyIcon,
      items: [
        { title: "Best Khaki Drip", text: "Show off your khaki style. Your state votes." },
        { title: "Camp Talent Showdown", text: "Sing, dance or make us laugh." },
        { title: "Man O' War Challenge", text: "Post your best obstacle-course moment." },
        { title: "Mammy Market Cook-off", text: "Who makes the best camp meal?" },
        { title: "Best CDS Project", text: "Share your community project and win." },
      ],
    },
    {
      heading: "Awards",
      Icon: MedalIcon,
      items: [
        { title: "Corper of the Month", text: "Voted by corpers in your state." },
        { title: "Best Platoon", text: "Platoon pride, settled by votes." },
        { title: "Camp Comedian", text: "The funniest corper in camp." },
        { title: "Social Night MVP", text: "The star of social night." },
        { title: `Most Stylish in ${state || "your state"}`, text: "Your state picks its best dressed." },
      ],
    },
    {
      heading: "Opportunities",
      Icon: BriefcaseIcon,
      items: [
        { title: "Jobs from ex-corpers", text: "Openings shared by people who served before you." },
        { title: "Remote gigs", text: "Paid online work you can do during service." },
        { title: "Retention at your PPA", text: "Tips and openings to get retained." },
        { title: "Skills and SAED", text: "Training to start your own business." },
        { title: "Scholarships and grants", text: "Funding for your next step." },
      ],
    },
  ] satisfies { heading: string; Icon: typeof TrophyIcon; items: Item[] }[];
}

/**
 * "Coming soon" cards.
 * `grid`: three small tiles (landing). `rows`: a sideways-scrolling row of locked cards per section (home).
 */
export default function ComingSoon(props: { layout: "grid" } | { layout: "rows"; state: string | null }) {
  const [toast, show] = useToast();

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
              className="flex flex-col gap-2.5 rounded-[18px] bg-surface px-3 py-3.5 text-left"
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

  return (
    <>
      {sections(props.state).map(({ heading, Icon, items }) => (
        <section key={heading} className="flex flex-col gap-3" aria-label={`${heading}, coming soon`}>
          <h2 className="h-display text-xl">{heading}</h2>
          <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-5 px-5 overscroll-x-contain">
            {items.map(({ title, text }) => (
              <button
                key={title}
                type="button"
                onClick={() => show(`${title} is coming soon`)}
                className="relative flex w-[220px] shrink-0 snap-start flex-col gap-3 rounded-[18px] bg-surface p-4 text-left"
              >
                <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-[11px] font-bold text-muted">
                  <LockIcon size={11} strokeWidth={2.5} />
                  Coming soon
                </span>
                <span className="flex size-11 items-center justify-center rounded-[14px] bg-surface-2 text-pink-ink">
                  <Icon />
                </span>
                <span>
                  <span className="block font-bold leading-snug">{title}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted">{text}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {toast}
    </>
  );
}
