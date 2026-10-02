"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, SearchIcon } from "@/components/icons";

type Row = { state: string; slug: string; count: number; rank: number };

const fmt = (n: number) => new Intl.NumberFormat("en-NG").format(n);

/** Every state in one card, with a bar showing its size next to the biggest state. Searchable. */
export default function StateList({ rows, myState }: { rows: Row[]; myState: string | null }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const shown = query ? rows.filter((r) => r.state.toLowerCase().includes(query)) : rows;
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="states-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="states-title" className="h-display text-xl">
          All states
        </h2>
        <span className="text-xs text-faint">Corpers joined</span>
      </div>
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
          className="h-12 w-full rounded-full border border-line bg-transparent pl-11 pr-4 text-[15px] placeholder:text-faint focus:border-lime focus:outline-none"
        />
        <SearchIcon size={20} className="pointer-events-none absolute left-4 top-3.5 text-faint" />
      </div>
      {shown.length === 0 ? (
        <p className="rounded-[20px] border border-line px-4 py-6 text-center text-muted">No state matches “{q}”</p>
      ) : (
        <ol className="divide-y divide-line rounded-[20px] border border-line">
          {shown.map((r) => {
            const mine = r.state === myState;
            const empty = r.count === 0;
            return (
              <li key={r.state}>
                <Link href={`/corpers/${r.slug}`} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={`h-display w-6 shrink-0 text-center ${r.rank <= 3 && !empty ? "text-lime-ink" : "text-faint"}`}
                  >
                    {r.rank}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex items-center gap-2">
                      <span className={`truncate text-[15px] ${mine ? "font-bold" : "font-medium"} ${empty ? "text-muted" : ""}`}>
                        {r.state}
                      </span>
                      {mine && <span className="shrink-0 rounded-full bg-lime px-2 py-0.5 text-[11px] font-bold text-on-accent">You</span>}
                    </span>
                    <span className="h-1.5 rounded-full bg-surface-2" aria-hidden="true">
                      {!empty && (
                        <span
                          className={`block h-1.5 rounded-full ${mine ? "bg-lime" : "bg-pink/70"}`}
                          style={{ width: `${Math.max(3, (r.count / max) * 100)}%` }}
                        />
                      )}
                    </span>
                  </span>
                  <span className={`w-12 shrink-0 text-right text-[15px] font-bold tabular-nums ${empty ? "text-faint" : ""}`}>
                    {fmt(r.count)}
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-faint" />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
