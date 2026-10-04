"use client";

import Link from "next/link";
import { useState } from "react";
import CardArt, { type ArtKey } from "./CardArt";
import { LockIcon } from "./icons";
import Sheet from "./Sheet";

type Item = { title: string; text: string; art: ArtKey };

function sections(state: string | null) {
  return [
    {
      heading: "Contests",
      art: "talent",
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
      art: "corper-month",
      items: [
        { title: "Corper of the Month", text: "Voted by corpers in your state.", art: "corper-month" },
        { title: "Best Platoon", text: "Platoon pride, settled by votes.", art: "platoon" },
        { title: "Camp Comedian", text: "The funniest corper in camp.", art: "comedian" },
        { title: "Social Night MVP", text: "The star of social night.", art: "mvp" },
        { title: `Most Stylish in ${state || "your state"}`, text: "Your state picks its best dressed.", art: "stylish" },
      ],
    },
  ] satisfies { heading: string; art: ArtKey; items: Item[] }[];
}

const tile = "flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-line text-left active:bg-surface-2";

function TileBody({ art, heading, note, locked }: { art: ArtKey; heading: string; note: string; locked: boolean }) {
  return (
    <>
      <span className="block aspect-[2/1] w-full">
        <CardArt art={art} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 px-2.5 pb-3 pt-2">
        <span className="truncate text-[13px] font-bold" title={heading}>
          {heading}
        </span>
        <span className={`flex items-center gap-1 truncate text-xs ${locked ? "text-muted" : "font-bold text-lime-ink"}`}>
          {locked && <LockIcon size={11} strokeWidth={2.5} />}
          {note}
        </span>
      </span>
    </>
  );
}

/**
 * "Explore" on Home: Opportunities (live, opens /opportunities) and Contests and Awards (coming soon; each opens
 * a sheet listing what's planned). Each tile has its illustration on top.
 */
export default function ComingSoon({ state, newOpportunities }: { state: string | null; newOpportunities: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const all = sections(state);
  const current = all.find((s) => s.heading === open);
  return (
    <section className="flex flex-col gap-3" aria-labelledby="explore-title">
      <h2 id="explore-title" className="h-display text-xl">
        Explore
      </h2>
      <div className="grid grid-cols-3 gap-2.5">
        <Link href="/opportunities" className={tile}>
          <TileBody art="jobs" heading="Opportunities" note={newOpportunities > 0 ? `${newOpportunities} new` : "Open"} locked={false} />
        </Link>
        {all.map(({ heading, art, items }) => (
          <button key={heading} type="button" onClick={() => setOpen(heading)} className={tile}>
            <TileBody art={art} heading={heading} note={`${items.length} coming`} locked />
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
