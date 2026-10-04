import { ExternalIcon } from "./icons";
import { CATEGORY_LABEL, type Category, type Opportunity } from "@/lib/opportunities";
import { timeAgo } from "@/lib/util";

const DOT: Record<Category, string> = {
  jobs: "#C6F432",
  internships: "#4FD1C5",
  scholarships: "#FFB547",
  fellowships: "#8B7BFF",
  grants: "#FF4FA3",
  contests: "#FF4FA3",
  programs: "#8B98A5",
};

export function CategoryChip({ category }: { category: Category }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold">
      <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: DOT[category] }} />
      {CATEGORY_LABEL[category]}
    </span>
  );
}

/**
 * One opportunity. Opens the source site in a new tab, where people apply.
 * `compact`: the narrow card in the Home strip; otherwise the full row on /opportunities.
 */
export default function OpportunityCard({ o, compact = false }: { o: Opportunity; compact?: boolean }) {
  const meta = [o.source, o.deadline ? `Closes ${o.deadline}` : timeAgo(o.published_at)].join(" · ");
  return (
    <a
      href={o.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex flex-col gap-2.5 rounded-[20px] border border-line p-4 active:bg-surface-2 ${compact ? "w-[248px] shrink-0" : ""}`}
    >
      <span className="flex items-center justify-between gap-2">
        <CategoryChip category={o.category} />
        {o.pinned ? <span className="text-xs font-bold text-lime-ink">Featured</span> : <ExternalIcon size={16} className="text-faint" />}
      </span>
      <span className={`font-bold leading-snug ${compact ? "line-clamp-3 text-[15px]" : "line-clamp-2 text-base"}`}>{o.title}</span>
      {!compact && o.summary && <span className="line-clamp-2 text-sm leading-snug text-muted">{o.summary}</span>}
      <span className="mt-auto truncate text-xs text-faint">{meta}</span>
    </a>
  );
}
