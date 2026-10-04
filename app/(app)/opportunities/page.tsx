import type { Metadata } from "next";
import Link from "next/link";
import OpportunityCard from "@/components/OpportunityCard";
import { ChevronLeft } from "@/components/icons";
import { CATEGORIES, CATEGORY_LABEL, getOpportunities, isCategory } from "@/lib/opportunities";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Opportunities" };

const PAGE_SIZE = 20;

type Props = { searchParams: Promise<{ c?: string; page?: string }> };

export default async function OpportunitiesPage({ searchParams }: Props) {
  await requireUser();
  const { c, page: p } = await searchParams;
  const category = isCategory(c) ? c : undefined;
  const page = Math.max(1, Math.min(20, Number(p) || 1));
  const rows = await getOpportunities({ category, limit: page * PAGE_SIZE + 1 });
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
        <p className="card text-[15px] text-muted">Nothing here right now. New opportunities arrive every morning.</p>
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
