import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { setFlag } from "@/app/actions/admin";
import { btn, panel } from "../ui";

export const metadata: Metadata = { title: "Suspicious activity" };

export default async function AdminSuspiciousPage() {
  await requireAdmin();
  const [fastReferrers, sharedIps] = await Promise.all([
    sql<{ id: string; nickname: string; n: number; last_hour: number }[]>`
      SELECT ref.id, ref.nickname, count(*)::int AS n,
             count(*) FILTER (WHERE u.completed_at > now() - interval '1 hour')::int AS last_hour
      FROM users u JOIN users ref ON ref.id = u.referred_by
      WHERE u.completed_at > now() - interval '24 hours' AND NOT ref.is_flagged AND NOT ref.is_banned AND NOT ref.is_seed
      GROUP BY ref.id, ref.nickname
      HAVING count(*) FILTER (WHERE u.completed_at > now() - interval '1 hour') >= 5 OR count(*) >= 15
      ORDER BY n DESC LIMIT 20
    `,
    sql<{ signup_ip_hash: string; n: number; users: { id: string; nickname: string }[] }[]>`
      SELECT signup_ip_hash, count(*)::int AS n,
             json_agg(json_build_object('id', id, 'nickname', nickname) ORDER BY created_at) AS users
      FROM users WHERE signup_ip_hash IS NOT NULL AND created_at > now() - interval '7 days'
      GROUP BY signup_ip_hash HAVING count(*) >= 3
      ORDER BY n DESC LIMIT 20
    `,
  ]);

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <div className={panel}>
        <h2 className="h-display mb-1 text-lg">Fast referrers</h2>
        <p className="mb-3 text-xs text-muted">5+ referrals in the last hour, or 15+ in 24 hours.</p>
        {fastReferrers.length === 0 ? (
          <p className="text-sm text-muted">Nothing suspicious.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {fastReferrers.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span>
                  <Link href={`/admin/users/${r.id}`} className="font-bold underline">
                    {r.nickname}
                  </Link>{" "}
                  <span className="text-muted">
                    {r.n} in 24h · {r.last_hour} in 1h
                  </span>
                </span>
                <form action={setFlag}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="on" value="1" />
                  <button className={btn}>Flag</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={panel}>
        <h2 className="h-display mb-1 text-lg">Many sign-ups, same network</h2>
        <p className="mb-3 text-xs text-muted">3+ accounts from one network in 7 days. Could be a shared camp Wi-Fi.</p>
        {sharedIps.length === 0 ? (
          <p className="text-sm text-muted">Nothing suspicious.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {sharedIps.map((r) => (
              <li key={r.signup_ip_hash}>
                <span className="font-bold">{r.n} accounts:</span>{" "}
                {r.users.map((u, i) => (
                  <span key={u.id}>
                    {i > 0 && ", "}
                    <Link href={`/admin/users/${u.id}`} className="text-muted underline-offset-2 hover:underline">
                      {u.nickname}
                    </Link>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
