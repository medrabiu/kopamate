"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/verification", label: "Verification" },
  { href: "/admin/suspicious", label: "Suspicious" },
  { href: "/admin/rewards", label: "Rewards" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin sections" className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
      {LINKS.map(({ href, label }) => {
        const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-bold ${
              active ? "bg-lime text-on-accent" : "bg-surface text-muted hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
