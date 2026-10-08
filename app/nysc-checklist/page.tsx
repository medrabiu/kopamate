import type { Metadata } from "next";
import Link from "next/link";
import ChecklistApp from "@/components/pcm/ChecklistApp";
import ChecklistHeader from "@/components/pcm/ChecklistHeader";
import { APP_URL } from "@/lib/config";
import { getGuideState } from "@/lib/pcm-guide";

// The same page for everyone, served from the cache (fast on slow data). Admin saves refresh it at once
// (revalidatePath in app/actions/admin-pcm.ts); a signed-in person's progress loads after it (ChecklistApp).
export const revalidate = 300;

const DESCRIPTION =
  "A free, personal NYSC checklist for prospective corps members: senate list, NERD clearance, registration, call-up letter, medical certificate, camp documents and the packing list.";

export async function generateMetadata(): Promise<Metadata> {
  const { guide } = await getGuideState();
  const title = `NYSC checklist: get camp-ready (${guide.batchLabel})`;
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: "/nysc-checklist" },
    openGraph: { title, description: DESCRIPTION, url: "/nysc-checklist", type: "article" },
    twitter: { card: "summary_large_image", title, description: DESCRIPTION },
  };
}

export default async function ChecklistPage() {
  const state = await getGuideState();

  return (
    <div className="min-h-screen-safe">
      {/* Mark that JavaScript runs, before anything paints: collapsed steps hide only then (globals.css). */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      <ChecklistHeader />

      <main className="mx-auto max-w-[600px] px-5 pt-6 pb-16">
        {!state.enabled ? (
          <section className="flex flex-col items-center gap-3 py-24 text-center">
            <h1 className="h-display text-[28px]">NYSC checklist</h1>
            <p className="text-muted">Coming back soon. We&apos;re updating the guide for the next batch.</p>
            <Link href="/" className="btn-secondary mt-2 w-auto px-8">
              Go to Kopamate
            </Link>
          </section>
        ) : (
          <ChecklistApp guide={state.guide} contact={{ whatsapp: state.supportWhatsapp, email: state.supportEmail }} appUrl={APP_URL} />
        )}
      </main>
    </div>
  );
}
