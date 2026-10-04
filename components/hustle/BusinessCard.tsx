import Link from "next/link";
import type { PublicBusiness } from "@/lib/hustle/market";
import { ChevronRight } from "@/components/icons";
import { BizLogo } from "./BizArt";

const BAND = { Bronze: "#d08a4a", Silver: "#b8c2cc", Gold: "#ffd166", Diamond: "#7fc4ff" } as const;

/** A player's business on profiles: name, type, state, stage, rating and score band. Links to their shop. */
export default function BusinessCard({ b, onClick }: { b: PublicBusiness; onClick?: () => void }) {
  return (
    <Link href={`/hustle/b/${b.slug}`} onClick={onClick} className="flex items-center gap-3 rounded-2xl border border-line p-3">
      <BizLogo icon={b.icon} color={b.color} size={44} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold">{b.name}</span>
        <span className="truncate text-[13px] text-muted">
          {b.type_name} · {b.state} · Stage {b.stage} · ★ {b.rating.toFixed(1)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold">
        <span className="h-2 w-2 rounded-full" style={{ background: BAND[b.band as keyof typeof BAND] }} aria-hidden="true" />
        {b.band}
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted" />
    </Link>
  );
}
