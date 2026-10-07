import type { Metadata } from "next";
import BottomNav from "@/components/BottomNav";
import { PeopleProvider } from "@/components/PersonSheet";
import RefreshOnReturn from "@/components/RefreshOnReturn";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The signed-in app is personal: keep it out of search results. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <PeopleProvider viewerId={user.id}>
      {/*
        App shell: the page itself never scrolls (globals.css), only the content area above the nav does.
        iPhone browsers ignore overscroll-behavior on the page and stretch the whole screen, a "fixed" nav
        included, when you pull past the end. With the nav outside the scrolling area, it can't move.
        Pinned to the screen edges (fixed, inset 0) rather than h-dvh: iPhone Safari sometimes keeps a stale
        dvh after the keyboard closes or the tab comes back, which left the nav floating above a black band.
      */}
      <div className="app-shell fixed inset-0 flex flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-5 pb-8 pt-5">{children}</main>
        </div>
        <BottomNav />
      </div>
      <RefreshOnReturn />
    </PeopleProvider>
  );
}
