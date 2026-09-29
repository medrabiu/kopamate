"use client";

import CardArt, { type ArtKey } from "./CardArt";
import { BriefcaseIcon, LockIcon, MedalIcon, TrophyIcon } from "./icons";
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
            {items.map(({ title, text, art }) => (
              <button
                key={title}
                type="button"
                onClick={() => show(`${title} is coming soon`)}
                className="relative flex w-[220px] shrink-0 snap-start flex-col overflow-hidden rounded-[18px] bg-surface text-left"
              >
                <span className="block h-[110px] w-full">
                  <CardArt art={art} />
                </span>
                <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-bg/85 px-2 py-1 text-[11px] font-bold text-ink backdrop-blur-sm">
                  <LockIcon size={11} strokeWidth={2.5} />
                  Coming soon
                </span>
                <span className="flex items-start gap-2.5 p-3.5">
                  <Icon size={18} className="mt-0.5 shrink-0 text-pink-ink" />
                  <span className="min-w-0">
                    <span className="block font-bold leading-snug">{title}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">{text}</span>
                  </span>
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
