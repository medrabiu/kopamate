import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import OpportunityCard from "@/components/OpportunityCard";
import { ChevronLeft } from "@/components/icons";
import { CATEGORIES, CATEGORY_LABEL, getOpportunities, isCategory, refreshIfStale } from "@/lib/opportunities";
import { requireUser } from "@/lib/session";
import CheckButton from "./CheckButton";

export const metadata: Metadata = { title: "Opportunities" };

const PAGE_SIZE = 20;

type Props = { searchParams: Promise<{ c?: string; page?: string }> };

export default async function OpportunitiesPage({ searchParams }: Props) {
  await requireUser();
  const { c, page: p } = await searchParams;
  const category = isCategory(c) ? c : undefined;
  const page = Math.max(1, Math.min(20, Number(p) || 1));
  let rows = await getOpportunities({ category, limit: page * PAGE_SIZE + 1 });
  if (rows.length === 0 && !category) {
    // Nothing at all yet (first visit before the morning run, or the run failed): fetch now, once.
    if (await refreshIfStale(10 * 60 * 1000)) rows = await getOpportunities({ limit: page * PAGE_SIZE + 1 });
  } else {
    // Backup for a missed morning run; never makes this visit wait.
    after(() => refreshIfStale(20 * 60 * 60 * 1000).catch(() => {}));
  }
  const hasMore = rows.length > page * PAGE_SIZE;
  const shown = rows.slice(0, page * PAGE_SIZE);
  const href = (cat?: string, n?: number) => {
    const q = new URLSearchParams();
    if (cat) q.set("c", cat);
    if (n && n > 1) q.set("page", String(n));
    const s = q.toString();
    return s ? `/opportunities?${s}` : "/opportunities";
  };

  return (
    <>
      <header className="flex h-11 items-center">
        <Link href="/home" className="-ml-2 flex items-center gap-1 py-2 pr-2 text-[15px] font-bold" aria-label="Back to Home">
          <ChevronLeft size={20} />
          Opportunities
        </Link>
      </header>

      <nav aria-label="Categories" className="no-scrollbar -mx-5 -mt-1 flex gap-2 overflow-x-auto px-5">
        {[undefined, ...CATEGORIES].map((cat) => {
          const active = cat === category;
          return (
            <Link
              key={cat ?? "all"}
              href={href(cat)}
              prefetch={false}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-bold ${
                active ? "bg-lime text-on-accent" : "border border-line text-muted"
              }`}
            >
              {cat ? CATEGORY_LABEL[cat] : "All"}
            </Link>
          );
        })}
      </nav>

      {shown.length === 0 ? (
        <section className="card flex flex-col gap-3 !p-[22px]">
          <p className="h-display text-xl">{category ? `No ${CATEGORY_LABEL[category].toLowerCase()} right now` : "Nothing here yet"}</p>
          <p className="text-[15px] text-muted">
            {category
              ? "New ones come in every morning. Try another category, or check again now."
              : "We collect new jobs, internships and scholarships every morning. Check now to pull the latest."}
          </p>
          {category ? (
            <div className="grid grid-cols-2 gap-2.5">
              <Link href={href()} scroll={false} className="btn-secondary h-12 text-[15px]">
                See all
              </Link>
              <CheckButton />
            </div>
          ) : (
            <CheckButton />
          )}
        </section>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((o) => (
            <li key={o.id}>
              <OpportunityCard o={o} />
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <Link href={href(category, page + 1)} prefetch={false} scroll={false} className="btn-secondary">
          Show more
        </Link>
      )}

      <p className="px-1 text-center text-[13px] leading-relaxed text-faint">
        Collected every morning from public opportunity sites. You apply on their site. Never pay anyone to apply for a
        job or scholarship.
      </p>
    </>
  );
}
