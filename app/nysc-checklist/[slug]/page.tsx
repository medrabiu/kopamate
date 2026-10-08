import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ChecklistHeader from "@/components/pcm/ChecklistHeader";
import RichText from "@/components/pcm/RichText";
import SignedInHint from "@/components/pcm/SignedInHint";
import { APP_URL } from "@/lib/config";
import { getGuideState } from "@/lib/pcm-guide";
import type { Guide, Situation, Step } from "@/content/pcm-guide";

// One page per step and per situation of the NYSC checklist, for search: the same for everyone, cached, and
// refreshed when an admin saves the guide (revalidatePath in app/actions/admin-pcm.ts).
export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

function find(guide: Guide, slug: string): { step: Step; index: number; steps: Step[] } | { situation: Situation } | null {
  const steps = guide.steps.filter((s) => s.show);
  const index = steps.findIndex((s) => s.slug === slug);
  if (index >= 0) return { step: steps[index], index, steps };
  const situation = guide.situations.find((s) => s.show && s.slug === slug);
  return situation ? { situation } : null;
}

export async function generateStaticParams() {
  const { guide } = await getGuideState();
  return [...guide.steps, ...guide.situations].filter((x) => x.show).map((x) => ({ slug: x.slug }));
}

/** "Get your NERD clearance" → "How to get your NERD clearance" for the page title. */
const howTo = (title: string) => `How to ${title.charAt(0).toLowerCase()}${title.slice(1)}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, { guide }] = await Promise.all([params, getGuideState()]);
  const hit = find(guide, slug);
  if (!hit) return { title: "Not found", robots: { index: false } };
  const title = "step" in hit ? `${howTo(hit.step.title)} (NYSC ${guide.batchLabel})` : `${hit.situation.title}: your NYSC guide and what to prepare`;
  const description = "step" in hit ? hit.step.short : `${hit.situation.subtitle}. ${hit.situation.intro}`.slice(0, 300);
  return {
    title,
    description,
    alternates: { canonical: `/nysc-checklist/${slug}` },
    openGraph: { title, description, url: `/nysc-checklist/${slug}`, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

function List({ items, numbered }: { items: string[]; numbered?: boolean }) {
  const Tag = numbered ? "ol" : "ul";
  return (
    <Tag className={`flex flex-col gap-2 pl-5 text-[16px] leading-relaxed ${numbered ? "list-decimal" : "list-disc"}`}>
      {items.map((t, i) => (
        <li key={i}>
          <RichText text={t} />
        </li>
      ))}
    </Tag>
  );
}

export default async function ChecklistSectionPage({ params }: Props) {
  const [{ slug }, state] = await Promise.all([params, getGuideState()]);
  const { guide } = state;
  if (!state.enabled) notFound();
  const hit = find(guide, slug);
  if (!hit) notFound();
  const name = "step" in hit ? hit.step.title : hit.situation.title;
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Kopamate", item: `${APP_URL}/` },
      { "@type": "ListItem", position: 2, name: "NYSC checklist", item: `${APP_URL}/nysc-checklist` },
      { "@type": "ListItem", position: 3, name, item: `${APP_URL}/nysc-checklist/${slug}` },
    ],
  };
  const tips = "step" in hit ? guide.tips.filter((t) => t.stepSlug === slug) : [];

  return (
    <div className="min-h-screen-safe">
      <ChecklistHeader />
      <SignedInHint />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c") }} />
      <main className="mx-auto flex max-w-[600px] flex-col gap-7 px-5 pt-5 pb-16">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href="/nysc-checklist" className="underline">
            NYSC checklist
          </Link>{" "}
          › {name}
        </nav>

        {"step" in hit ? (
          <>
            <header className="flex flex-col gap-2">
              <span className="text-xs font-bold tracking-wide text-lime-ink uppercase">
                Step {hit.index + 1} of {hit.steps.length} · {guide.batchLabel}
              </span>
              <h1 className="h-display text-[30px] leading-tight">{hit.step.title}</h1>
              <p className="text-[17px] leading-relaxed text-muted">
                <RichText text={hit.step.what} />
              </p>
              <div className="flex flex-wrap gap-2 text-sm font-bold">
                {hit.step.cost && <span className="rounded-full bg-surface-2 px-3 py-1.5">💰 {hit.step.cost}</span>}
                {hit.step.time && <span className="rounded-full bg-surface-2 px-3 py-1.5">⏱ {hit.step.time}</span>}
              </div>
            </header>
            {hit.step.why && (
              <section className="rounded-2xl border border-lime/50 bg-lime/10 p-4" aria-labelledby="why">
                <h2 id="why" className="text-xs font-bold tracking-wide text-lime-ink uppercase">
                  Why it matters
                </h2>
                <p className="mt-1 text-[16px] leading-relaxed">
                  <RichText text={hit.step.why} />
                </p>
              </section>
            )}
            {hit.step.how.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="how">
                <h2 id="how" className="h-display text-xl">
                  How to do it
                </h2>
                <List items={hit.step.how} numbered />
              </section>
            )}
            {hit.step.bring.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="bring">
                <h2 id="bring" className="h-display text-xl">
                  What to bring
                </h2>
                <List items={hit.step.bring} />
              </section>
            )}
            {hit.step.mistakes.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="mistakes">
                <h2 id="mistakes" className="h-display text-xl">
                  Common mistakes
                </h2>
                <ul className="flex flex-col gap-2">
                  {hit.step.mistakes.map((m, i) => (
                    <li key={i} className="rounded-2xl border border-pink/40 bg-pink/10 px-4 py-3 text-[16px]">
                      ⚠️ <RichText text={m} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {tips.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="tips">
                <h2 id="tips" className="h-display text-xl">
                  From corpers who did it
                </h2>
                <ul className="flex flex-col gap-2">
                  {tips.map((t, i) => (
                    <li key={i} className="rounded-2xl bg-surface-2 p-3.5">
                      <span className="block text-xs font-bold text-muted">{t.authorLabel}</span>
                      <span className="block text-[16px]">{t.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <>
            <header className="flex flex-col gap-2">
              <span className="text-xs font-bold tracking-wide text-lime-ink uppercase">NYSC situation guide · {guide.batchLabel}</span>
              <h1 className="h-display text-[30px] leading-tight">{hit.situation.title}</h1>
              <p className="text-[17px] leading-relaxed text-muted">
                <RichText text={hit.situation.intro} />
              </p>
            </header>
            <section className="flex flex-col gap-3" aria-labelledby="prepare">
              <h2 id="prepare" className="h-display text-xl">
                Extra things to prepare
              </h2>
              <List items={hit.situation.items} />
            </section>
            {hit.situation.notes.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="notes">
                <h2 id="notes" className="h-display text-xl">
                  Good to know
                </h2>
                <List items={hit.situation.notes} />
              </section>
            )}
          </>
        )}

        <section className="flex flex-col gap-3 rounded-3xl bg-lime p-5 text-on-accent">
          <h2 className="h-display text-xl">Get your personal NYSC plan</h2>
          <p className="text-[15px] opacity-80">Answer 6 quick questions and tick off every step, document and item to pack. Free.</p>
          <Link href={`/nysc-checklist#${slug}`} className="flex h-12 items-center justify-center rounded-full bg-on-accent font-bold text-lime">
            Build my plan
          </Link>
        </section>

        {"step" in hit && (
          <nav className="flex justify-between gap-3 text-sm font-bold" aria-label="Other steps">
            {hit.index > 0 ? (
              <Link href={`/nysc-checklist/${hit.steps[hit.index - 1].slug}`} className="min-w-0 text-lime-ink">
                ‹ {hit.steps[hit.index - 1].title}
              </Link>
            ) : (
              <span />
            )}
            {hit.index < hit.steps.length - 1 && (
              <Link href={`/nysc-checklist/${hit.steps[hit.index + 1].slug}`} className="min-w-0 text-right text-lime-ink">
                {hit.steps[hit.index + 1].title} ›
              </Link>
            )}
          </nav>
        )}

        <section className="flex flex-col gap-2" aria-labelledby="all-steps">
          <h2 id="all-steps" className="text-xs font-bold tracking-wider text-faint uppercase">
            All NYSC steps
          </h2>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px]">
            {guide.steps
              .filter((s) => s.show)
              .map((s) => (
                <li key={s.slug}>
                  {s.slug === slug ? (
                    <span className="font-bold">{s.title}</span>
                  ) : (
                    <Link href={`/nysc-checklist/${s.slug}`} className="underline">
                      {s.title}
                    </Link>
                  )}
                </li>
              ))}
          </ol>
        </section>

        <footer className="flex flex-col gap-1 border-t border-line pt-5 text-xs leading-relaxed text-faint">
          <span>Written and reviewed by the Kopamate team. Last reviewed for {guide.batchLabel}.</span>
          <span>Kopamate is not affiliated with NYSC. Always follow official NYSC instructions.</span>
        </footer>
      </main>
    </div>
  );
}
