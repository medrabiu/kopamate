import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Profiles: inside the app (with the bottom nav) when signed in; a plain public page for the logged-out preview. */
export default async function ProfilesLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user?.completed_at) return <AppShell viewerId={user.id}>{children}</AppShell>;
  return children;
}
