import BottomNav from "./BottomNav";
import { PeopleProvider } from "./PersonSheet";
import RefreshOnReturn from "./RefreshOnReturn";

/**
 * The signed-in app's frame: a scrolling content area above the bottom nav. Used by app/(app) and by profile
 * pages (/u/…) when the viewer is signed in.
 *
 * The page itself never scrolls (globals.css), only the content area above the nav does. iPhone browsers ignore
 * overscroll-behavior on the page and stretch the whole screen, a "fixed" nav included, when you pull past the
 * end. With the nav outside the scrolling area, it can't move. Pinned to the screen edges (fixed, inset 0)
 * rather than h-dvh: iPhone Safari sometimes keeps a stale dvh after the keyboard closes or the tab comes back,
 * which left the nav floating above a black band.
 */
export default function AppShell({ viewerId, children }: { viewerId: string; children: React.ReactNode }) {
  return (
    <PeopleProvider viewerId={viewerId}>
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
