import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PreviewPill from "@/components/hustle/PreviewPill";
import { hustleEnabledFor } from "@/lib/hustle/access";
import { getHustleUiMode } from "@/lib/hustle/ui-mode";
import { isAdmin, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: { default: "My Hustle", template: "%s · My Hustle" } };

/**
 * My Hustle is behind the hustle_enabled flag (off, admins, all): anyone it's off for gets a 404.
 * Admins also get the "Viewing" pill, to compare display modes on their own phone.
 */
export default async function HustleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!(await hustleEnabledFor(user))) notFound();
  if (!isAdmin(user)) return children;
  const ui = await getHustleUiMode(user);
  return (
    <>
      <PreviewPill preview={ui.preview} global={ui.global} fallback={ui.setting === "graphical" && ui.view === "text"} />
      {children}
    </>
  );
}
