import type { Metadata } from "next";
import Link from "next/link";
import OpportunitiesTeaser from "@/components/OpportunitiesTeaser";
import { ChevronLeft } from "@/components/icons";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Opportunities" };

/** Coming soon: people will apply without leaving Kopamate. Kept so old links land somewhere. */
export default async function OpportunitiesPage() {
  await requireUser();
  return (
    <>
      <header className="flex h-11 items-center">
        <Link href="/home" className="-ml-2 flex items-center gap-1 py-2 pr-2 text-[15px] font-bold" aria-label="Back to Home">
          <ChevronLeft size={20} />
          Opportunities
        </Link>
      </header>
      <OpportunitiesTeaser page />
    </>
  );
}
