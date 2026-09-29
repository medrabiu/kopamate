"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, SearchIcon } from "@/components/icons";

type Row = { state: string; slug: string; count: number; rank: number };

export default function StateList({ rows, myState }: { rows: Row[]; myState: string | null }) {
  const [q, setQ] = useState("");
  const shown = q ? rows.filter((r) => r.state.toLowerCase().includes(q.trim().toLowerCase())) : rows;

  return (
    <>
      <div className="relative">
        <label htmlFor="q" className="sr-only">
          Search a state
        </label>
        <input
          id="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a state"
          className="h-12 w-full rounded-full border border-line bg-surface pl-11 pr-4 text-[15px] placeholder:text-faint focus:border-lime focus:outline-none"
        />
        <SearchIcon size={20} className="pointer-events-none absolute left-4 top-3.5 text-faint" />
      </div>
      <ol className="flex flex-col">
        {shown.map((r) => {
          const mine = r.state === myState;
          return (
            <li key={r.state}>
              <Link
                href={`/corpers/${r.slug}`}
                className={`flex h-[52px] items-center gap-3 ${
                  mine ? "-mx-3 rounded-[14px] bg-surface px-3" : "border-b border-surface-2"
                }`}
              >
                <span className={`h-display w-6 ${r.rank <= 3 && r.count > 0 ? "text-lime-ink" : "text-faint"}`}>{r.rank}</span>
                <span className={`flex-1 text-base ${mine ? "font-bold" : "font-medium"}`}>
                  {r.state}
                  {mine && <span className="ml-2 rounded-full bg-lime px-2 py-0.5 text-xs font-bold text-on-accent">You</span>}
                </span>
                <span className="text-muted">{new Intl.NumberFormat("en-NG").format(r.count)}</span>
                <ChevronRight size={18} className="text-faint" />
              </Link>
            </li>
          );
        })}
        {shown.length === 0 && <li className="py-6 text-center text-muted">No state matches “{q}”</li>}
      </ol>
    </>
  );
}
