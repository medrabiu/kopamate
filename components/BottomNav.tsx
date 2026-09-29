"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GiftIcon, HomeIcon, LinkIcon, UserIcon, UsersIcon } from "./icons";

const TABS = [
  { href: "/home", label: "Home", Icon: HomeIcon },
  { href: "/corpers", label: "Corpers", Icon: UsersIcon },
  { href: "/invite", label: "Invite", Icon: LinkIcon },
  { href: "/rewards", label: "Rewards", Icon: GiftIcon },
  { href: "/profile", label: "Profile", Icon: UserIcon },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-2 bg-bg/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid h-[76px] max-w-[480px] grid-cols-5">
        {TABS.map(({ href, label, Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
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
