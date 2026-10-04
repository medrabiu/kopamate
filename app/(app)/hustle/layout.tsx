import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hustleEnabledFor } from "@/lib/hustle/access";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: { default: "My Hustle", template: "%s · My Hustle" } };

/** My Hustle is behind the hustle_enabled flag (off, admins, all): anyone it's off for gets a 404. */
export default async function HustleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!(await hustleEnabledFor(user))) notFound();
  return children;
}
