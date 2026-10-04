"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/hustle", label: "My business" },
  { href: "/hustle/market", label: "Market" },
  { href: "/hustle/wallet", label: "Wallet" },
];

/** My Hustle's own sections, as a segmented control under the page title. */
export default function HustleTabs() {
  const path = usePathname();
  return (
    <nav aria-label="My Hustle" className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
      {TABS.map(({ href, label }) => {
        const active = href === "/hustle" ? path === "/hustle" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-10 items-center justify-center truncate rounded-full px-2 text-sm font-bold ${active ? "bg-bg text-ink" : "text-muted"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
