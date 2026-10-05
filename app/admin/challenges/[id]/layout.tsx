import Link from "next/link";
import { sql } from "@/lib/db";
import { challengeOr404, STATUS_LABEL } from "../parts";
import ChallengeTabs from "./ChallengeTabs";

export default async function ChallengeAdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const c = await challengeOr404(params);
  const [{ pending }] = await sql<{ pending: number }[]>`
    SELECT count(*)::int AS pending FROM challenge_entries WHERE challenge_id = ${c.id} AND status = 'pending'
  `;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/challenges" className="text-sm text-muted">
            ← Challenges
          </Link>
          <h2 className="h-display text-2xl">
            {c.title} <span className="rounded-full border border-line px-2.5 py-0.5 align-middle text-xs">{STATUS_LABEL[c.status]}</span>
          </h2>
        </div>
        <div className="flex gap-2">
          {c.status !== "draft" && (
            <Link href={`/challenges/${c.slug}`} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold hover:bg-surface-2">
              View in app
            </Link>
          )}
          <a href={`/admin/challenges/${c.id}/export`} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold hover:bg-surface-2">
            Export CSV
          </a>
        </div>
      </div>
      <ChallengeTabs id={c.id} pending={pending} />
      {children}
    </>
  );
}
