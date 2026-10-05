import type { Metadata } from "next";
import Link from "next/link";
import { createChallenge } from "@/app/actions/admin-challenges";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { btnPrimary, input, panel } from "../ui";
import { Notice, STATUS_LABEL } from "./parts";

export const metadata: Metadata = { title: "Challenges" };

export default async function AdminChallengesPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const rows = await sql<{ id: number; title: string; slug: string; status: string; entries: number; pending: number; closes_at: Date | null }[]>`
    SELECT c.id, c.title, c.slug, c.status, c.closes_at,
           (SELECT count(*) FROM challenge_entries e WHERE e.challenge_id = c.id)::int AS entries,
           (SELECT count(*) FROM challenge_entries e WHERE e.challenge_id = c.id AND e.status = 'pending')::int AS pending
    FROM challenges c ORDER BY c.created_at DESC
  `;
  return (
    <>
      <Notice msg={msg} />
      <section className={panel}>
        <h2 className="h-display mb-3 text-lg">Challenges</h2>
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/challenges/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:underline">
                <span className="font-bold">{c.title}</span>
                <span className="text-sm text-muted">
                  {STATUS_LABEL[c.status]} · {c.entries} entries{c.pending ? ` · ${c.pending} to check` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className={panel}>
        <h2 className="h-display mb-3 text-lg">New challenge</h2>
        <form action={createChallenge} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Title
            <input name="title" required maxLength={100} placeholder="Kopamate Creator Challenge #2" className={`${input} w-72`} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Slug (in the link)
            <input name="slug" required pattern="[a-z0-9-]{3,60}" placeholder="creator-challenge-2" className={input} />
          </label>
          <button className={btnPrimary}>Create draft</button>
        </form>
      </section>
    </>
  );
}
