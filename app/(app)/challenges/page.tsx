import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, TrophyIcon } from "@/components/icons";
import { requireUser } from "@/lib/session";
import { getPool, listChallenges } from "@/lib/challenges";
import { formatNgn } from "@/lib/reward-meta";

export const metadata: Metadata = { title: "Challenges" };

const STATUS: Record<string, string> = { upcoming: "Coming soon", open: "Open now", closed: "Closed", results: "Winners announced" };

export default async function ChallengesPage() {
  await requireUser();
  const challenges = await listChallenges();
  const pools = await Promise.all(challenges.map((c) => getPool(c)));

  return (
    <>
      <h1 className="h-display text-[28px]">Challenges</h1>
      {challenges.length === 0 ? (
        <p className="text-muted">No challenges right now. Check back soon.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {challenges.map((c, i) => (
            <li key={c.id}>
              <Link href={`/challenges/${c.slug}`} className="card flex items-center gap-3.5">
                <span className={`grid size-11 shrink-0 place-items-center rounded-full ${c.status === "open" ? "bg-pink text-on-accent" : "bg-surface-2"}`}>
                  <TrophyIcon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{c.title}</span>
                  <span className="block text-sm text-muted">
                    {STATUS[c.status]} · Prize pool {formatNgn(pools[i].pool)}
                  </span>
                </span>
                <ChevronRight size={20} className="shrink-0 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
