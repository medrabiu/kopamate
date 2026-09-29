import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { timeAgo } from "@/lib/util";
import { markRewardSent } from "@/app/actions/admin";
import { btn, panel } from "../ui";

export const metadata: Metadata = { title: "Rewards" };

export default async function AdminRewardsPage() {
  await requireAdmin();
  const pending = await sql<
    { id: string; title: string; user_id: string; nickname: string; whatsapp_e164: string | null; created_at: Date }[]
  >`
    SELECT r.id, r.title, u.id AS user_id, u.nickname, u.whatsapp_e164, r.created_at
    FROM rewards r JOIN users u ON u.id = r.user_id
    WHERE r.status = 'pending' ORDER BY r.created_at LIMIT 100
  `;

  return (
    <>
      <section className={panel}>
        <h2 className="h-display mb-1 text-lg">Prize lists</h2>
        <p className="mb-3 text-xs text-muted">Verified users only. Flagged, banned and seed accounts are left out.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/admin/export?list=first" className={btn}>
            Download first 500 verified (CSV)
          </a>
          <a href="/admin/export?list=referrers" className={btn}>
            Download top 10 verified referrers (CSV)
          </a>
        </div>
      </section>

      <section className={panel}>
        <h2 className="h-display mb-1 text-lg">Rewards to send</h2>
        <p className="mb-3 text-xs text-muted">Add a reward from a user&apos;s page.</p>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">Nothing waiting.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span>
                  <span className="font-bold">{r.title}</span> →{" "}
                  <Link href={`/admin/users/${r.user_id}`} className="underline">
                    {r.nickname}
                  </Link>{" "}
                  <span className="text-muted">
                    {r.whatsapp_e164} · {timeAgo(r.created_at)}
                  </span>
                </span>
                <form action={markRewardSent}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className={btn}>Mark sent</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
