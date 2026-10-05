"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Sub-sections of one challenge in admin. */
export default function ChallengeTabs({ id, pending }: { id: number; pending: number }) {
  const path = usePathname();
  const base = `/admin/challenges/${id}`;
  const tabs = [
    { href: base, label: "Settings" },
    { href: `${base}/entries`, label: pending ? `Entries (${pending} to check)` : "Entries" },
    { href: `${base}/entrants`, label: "Entrants" },
    { href: `${base}/signups`, label: "Sign-ups" },
    { href: `${base}/winners`, label: "Winners" },
  ];
  return (
    <nav aria-label="Challenge sections" className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
      {tabs.map((t) => {
        const active = t.href === base ? path === base : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold ${active ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
