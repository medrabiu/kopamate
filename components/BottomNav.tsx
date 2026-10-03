"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { GiftIcon, HomeIcon, LinkIcon, UserIcon, UsersIcon } from "./icons";

const TABS = [
  { href: "/home", label: "Home", Icon: HomeIcon },
  { href: "/corpers", label: "Corpers", Icon: UsersIcon },
  { href: "/invite", label: "Invite", Icon: LinkIcon },
  { href: "/rewards", label: "Rewards", Icon: GiftIcon },
  { href: "/profile", label: "Profile", Icon: UserIcon },
];

const matches = (path: string, href: string) => path === href || path.startsWith(href + "/");

export default function BottomNav() {
  const path = usePathname();
  // The tab you just tapped lights up straight away, before its page has loaded.
  const [tapped, setTapped] = useState<string | null>(null);
  useEffect(() => setTapped(null), [path]);
  return (
    // touch-none: a swipe that starts on the nav doesn't drag the page under it; taps still work.
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 touch-none border-t border-line bg-bg/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid h-[76px] max-w-[480px] grid-cols-5">
        {TABS.map(({ href, label, Icon }) => {
          const active = tapped ? tapped === href : matches(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={matches(path, href) ? "page" : undefined}
              onClick={(e) => {
                // Only plain taps: modified clicks open a new browser tab and never change this page.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                if (!matches(path, href)) setTapped(href);
              }}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-100 ${
                active ? "text-lime-ink" : "text-faint hover:text-ink"
              }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
