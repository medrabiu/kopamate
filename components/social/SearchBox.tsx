"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "../icons";

/** Search by name or @username. Updates the address (debounced) so the server renders the results. */
export default function SearchBox() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function change(value: string) {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = new URLSearchParams(params);
      const term = value.trim();
      if (term.length >= 2) next.set("q", term.slice(0, 40));
      else next.delete("q");
      router.replace(next.size ? `${path}?${next}` : path, { scroll: false });
    }, 350);
  }

  return (
    <label className="relative block">
      <span className="sr-only">Search corpers by name</span>
      <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={q}
        onChange={(e) => change(e.target.value)}
        placeholder="Search by name or @username"
        autoComplete="off"
        autoCapitalize="none"
        className="field h-12 rounded-full pl-11"
      />
    </label>
  );
}
