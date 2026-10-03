import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { ranked } from "@/lib/ranking";
import { timeAgo } from "@/lib/util";
import { approveVerification, rejectVerification, unblockStateCode } from "@/app/actions/admin";
import VerificationSignals from "../VerificationSignals";
import { btn, btnPrimary, input, panel } from "../ui";

export const metadata: Metadata = { title: "Verification" };

type PendingRow = {
  id: string;
  nickname: string;
  full_name: string | null;
  state: string | null;
  state_code: string | null;
  whatsapp_e164: string | null;
  verification_requested_at: Date | null;
  position: number | null;
  refs: number | null;
  same_code: number;
};

export default async function AdminVerificationPage() {
  await requireAdmin();
  const blocked = await sql<{ code: string; reason: string | null; created_at: Date }[]>`
    SELECT code, reason, created_at FROM blocked_state_codes ORDER BY created_at DESC LIMIT 100
  `;
  const pending = await sql<PendingRow[]>`
    ${ranked()}
    SELECT u.id, u.nickname, u.full_name, u.state, u.state_code, u.whatsapp_e164, u.verification_requested_at, r.position, r.refs,
           (SELECT count(*)::int FROM users o WHERE o.state_code = u.state_code AND o.id <> u.id) AS same_code
    FROM users u LEFT JOIN ranked r ON r.id = u.id
    WHERE u.verification_status = 'pending'
    ORDER BY r.position NULLS LAST, u.verification_requested_at
    LIMIT 30
  `;

  return (
    <>
      <section className={panel}>
        <h2 className="h-display mb-1 text-lg">Verification requests</h2>
        <p className="mb-4 text-xs text-muted">
          Check the full name, state and state code on the ID card against what they typed, and read the warnings under each one.
          Highest positions first, 30 at a time. The photo is deleted when you approve or reject; only its fingerprint is kept.
        </p>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">No requests waiting.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {pending.map((v) => (
              <li key={v.id} className="flex flex-col gap-3 rounded-xl border border-line p-3">
                <a href={`/admin/id-card/${v.id}`} target="_blank" rel="noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/admin/id-card/${v.id}`}
                    alt={`ID card sent by ${v.nickname}`}
                    loading="lazy"
                    className="max-h-64 w-full rounded-lg bg-bg object-contain"
                  />
                </a>
                <div className="text-sm">
                  <Link href={`/admin/users/${v.id}`} className="font-bold underline-offset-2 hover:underline">
                    {v.nickname}
                  </Link>{" "}
                  · {v.state ?? "–"}
                  <div>
                    Full name <b>{v.full_name ?? "not given"}</b>
                  </div>
                  <div className="text-muted">
                    State code <b className="text-ink">{v.state_code}</b>
                    {v.same_code > 0 && <span className="text-pink-ink"> · used by {v.same_code} other account(s)</span>}
                  </div>
                  <div className="text-muted">
                    #{v.position ?? "–"} · {v.refs ?? 0} refs · {v.whatsapp_e164 ?? "no WhatsApp"} · sent {v.verification_requested_at ? timeAgo(v.verification_requested_at) : "–"}
                  </div>
                </div>
                <VerificationSignals userId={v.id} />
                <div className="flex flex-wrap items-center gap-2">
                  <form action={approveVerification}>
                    <input type="hidden" name="id" value={v.id} />
                    <button className={btnPrimary}>Approve</button>
                  </form>
                  <form action={rejectVerification} className="flex flex-1 flex-wrap gap-1.5">
                    <input type="hidden" name="id" value={v.id} />
                    <input name="note" maxLength={200} placeholder="Reason (shown to them)" className={`${input} min-w-0 flex-1`} />
                    <button className={btn}>Reject</button>
                    <label className="flex w-full items-center gap-1.5 text-xs text-muted">
                      <input type="checkbox" name="block_code" value="1" className="accent-pink" />
                      Fake state code: block it for every account
                    </label>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panel}>
        <h2 className="h-display mb-1 text-lg">Blocked state codes ({blocked.length})</h2>
        <p className="mb-3 text-xs text-muted">Codes rejected as fake. No account can send them again until you unblock them.</p>
        {blocked.length === 0 ? (
          <p className="text-sm text-muted">None.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {blocked.map((b) => (
              <li key={b.code} className="flex flex-wrap items-center gap-2">
                <b>{b.code}</b>
                <span className="text-muted">
                  {timeAgo(b.created_at)}
                  {b.reason ? ` · ${b.reason}` : ""}
                </span>
                <form action={unblockStateCode}>
                  <input type="hidden" name="code" value={b.code} />
                  <button className={btn}>Unblock</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
