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
      <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-5 pb-[112px] pt-5">{children}</main>
      <BottomNav />
      <RefreshOnReturn />
    </PeopleProvider>
  );
}
