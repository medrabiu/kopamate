import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The signed-in app is personal: keep it out of search results. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell viewerId={user.id}>{children}</AppShell>;
}
