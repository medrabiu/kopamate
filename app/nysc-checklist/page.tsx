import type { Metadata } from "next";
import Link from "next/link";
import ChecklistApp from "@/components/pcm/ChecklistApp";
import { LogoMark } from "@/components/Logo";
import { APP_NAME, APP_URL } from "@/lib/config";
import { getGuideState, getUserPlan } from "@/lib/pcm-guide";
import { getCurrentUser, isAdmin } from "@/lib/session";

// Rendered per request (it knows who's signed in); the guide itself comes from a cache.
export const dynamic = "force-dynamic";

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

type Props = { searchParams: Promise<{ preview?: string }> };

export default async function ChecklistPage({ searchParams }: Props) {
  const [{ preview: previewParam }, state, user] = await Promise.all([searchParams, getGuideState(), getCurrentUser()]);
  const signedIn = user?.completed_at ? user : null;
  const preview = previewParam === "1" && isAdmin(user);
  const plan = signedIn ? await getUserPlan(signedIn.id) : null;

  return (
    <div className="min-h-screen-safe">
      {/* Mark that JavaScript runs, before anything paints: collapsed steps hide only then (globals.css). */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      <header className="pcm-noprint sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[600px] items-center justify-between px-5">
          <Link href={signedIn ? "/home" : "/"} className="flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="h-display text-lg">{APP_NAME}</span>
          </Link>
          {signedIn ? (
            <Link href="/home" className="rounded-full px-3.5 py-2 text-[15px] font-bold hover:bg-surface-2">
              Open the app
            </Link>
          ) : (
            <nav className="flex items-center gap-1.5">
              <Link href="/login" className="rounded-full px-3.5 py-2 text-[15px] font-bold hover:bg-surface-2">
                Log in
              </Link>
              <Link href="/join" className="rounded-full bg-lime px-4 py-2 text-[15px] font-bold text-on-accent">
                Join
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[600px] px-5 pt-6 pb-16">
        {!state.enabled && !preview ? (
          <section className="flex flex-col items-center gap-3 py-24 text-center">
            <h1 className="h-display text-[28px]">NYSC checklist</h1>
            <p className="text-muted">Coming back soon. We&apos;re updating the guide for the next batch.</p>
            <Link href={signedIn ? "/home" : "/"} className="btn-secondary mt-2 w-auto px-8">
              {signedIn ? "Back to the app" : "Go to Kopamate"}
            </Link>
          </section>
        ) : (
          <ChecklistApp
            guide={state.guide}
            initialPlan={plan}
            inviteCode={signedIn?.referral_code ?? null}
            contact={{ whatsapp: state.supportWhatsapp, email: state.supportEmail }}
            appUrl={APP_URL}
            preview={preview}
          />
        )}
      </main>
    </div>
  );
}
