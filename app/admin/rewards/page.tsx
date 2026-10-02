import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { getBudget } from "@/lib/rewards";
import { formatNgn, KIND_LABEL } from "@/lib/reward-meta";
import { formatJoined, timeAgo } from "@/lib/util";
import { revealBatch } from "@/app/actions/admin-rewards";
import CopyButton from "../CopyButton";
import { btn, btnPrimary, panel } from "../ui";
import { amountLabel, BudgetTracker, Notice, RewardActions, StatusPill, type AdminReward } from "./parts";

export const metadata: Metadata = { title: "Rewards" };

type Row = AdminReward & { user_id: string; nickname: string; batch_id: string | null };

/** Payout rows: the only admin query (besides the user page) that reads payout details. */
type Payout = Row & {
  whatsapp_e164: string | null;
  payout_bank: string | null;
  payout_account_number: string | null;
  payout_account_name: string | null;
  payout_phone: string | null;
  claimed_at: Date | null;
};

const BACK = "/admin/rewards";

function Copyable({ value, label }: { value: string | null; label: string }) {
  if (!value) return <span className="text-muted">–</span>;
  return (
    <span className="whitespace-nowrap">
      {value}
      <CopyButton value={value} label={label} />
    </span>
  );
}

export default async function AdminRewardsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const cols = sql`r.id, r.title, r.kind, r.status, r.amount_ngn, r.admin_note, r.payment_reference, r.paid_at, r.created_at,
                   r.batch_id, u.id AS user_id, u.nickname`;
  const [budget, payouts, open, rejected, paid] = await Promise.all([
    getBudget(),
    sql<Payout[]>`
      SELECT ${cols}, u.whatsapp_e164, r.payout_bank, r.payout_account_number, r.payout_account_name, r.payout_phone, r.claimed_at
      FROM rewards r JOIN users u ON u.id = r.user_id
      WHERE r.status IN ('claimed', 'processing') ORDER BY r.status DESC, r.claimed_at LIMIT 300
    `,
    sql<Row[]>`
      SELECT ${cols} FROM rewards r JOIN users u ON u.id = r.user_id
      WHERE r.status IN ('hidden', 'unclaimed') ORDER BY r.created_at DESC, r.amount_ngn DESC NULLS LAST LIMIT 300
    `,
    sql<Row[]>`
      SELECT ${cols} FROM rewards r JOIN users u ON u.id = r.user_id
      WHERE r.status = 'rejected' ORDER BY r.rejected_at DESC LIMIT 50
    `,
    sql<Row[]>`
      SELECT ${cols} FROM rewards r JOIN users u ON u.id = r.user_id
      WHERE r.status = 'paid' ORDER BY r.paid_at DESC NULLS LAST LIMIT 30
    `,
  ]);

  // Hidden and unclaimed rewards, grouped by the award they came from (single awards together).
  const groups = new Map<string, Row[]>();
  for (const r of open) {
    const key = r.batch_id ?? "";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return (
    <>
      <Notice params={params} />
      <BudgetTracker b={budget} />

      <section className={panel}>
        <h2 className="h-display mb-1 text-lg">Award</h2>
        <p className="mb-3 text-xs text-muted">
          One person: open their page from Users. Several: tick them in Users and choose &quot;Award selected&quot;. Flagged, banned and seed
          accounts are skipped in every bulk award.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/rewards/award?mode=top" className={btnPrimary}>
            Top referrers
          </Link>
          <Link href="/admin/rewards/award?mode=early" className={btn}>
            All Early Corpers
          </Link>
          <Link href="/admin/users" className={btn}>
            Pick users
          </Link>
        </div>
      </section>

      <section className={panel} aria-labelledby="payouts-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="payouts-title" className="h-display text-lg">
            Payouts to send ({payouts.length})
          </h2>
          {payouts.length > 0 && (
            <a href="/admin/export?list=payouts" className={btn}>
              Download payouts (CSV)
            </a>
          )}
        </div>
        <p className="mb-3 text-xs text-muted">
          Claimed: the user can still change their details. Start processing to lock them before you pay.
        </p>
        {payouts.length === 0 ? (
          <p className="text-sm text-muted">Nothing to pay right now.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href={`/admin/users/${p.user_id}`} className="font-bold underline">
                    {p.nickname}
                  </Link>
                  <StatusPill status={p.status} />
                  <span className="font-bold">{p.amount_ngn ? formatNgn(p.amount_ngn) : "No amount"}</span>
                  <span>{KIND_LABEL[p.kind]}</span>
                  <span className="text-muted">{p.title}</span>
                  <span className="text-xs text-muted">claimed {p.claimed_at ? timeAgo(p.claimed_at) : "–"}</span>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 md:grid-cols-[auto_1fr_auto_1fr]">
                  <dt className="text-muted">WhatsApp</dt>
                  <dd>
                    <Copyable value={p.whatsapp_e164} label="WhatsApp number" />
                  </dd>
                  {p.kind === "cash" ? (
                    <>
                      <dt className="text-muted">Bank</dt>
                      <dd>
                        <Copyable value={p.payout_bank} label="bank" />
                      </dd>
                      <dt className="text-muted">Account number</dt>
                      <dd>
                        <Copyable value={p.payout_account_number} label="account number" />
                      </dd>
                      <dt className="text-muted">Account name</dt>
                      <dd>
                        <Copyable value={p.payout_account_name} label="account name" />
                      </dd>
                    </>
                  ) : (
                    <>
                      <dt className="text-muted">Phone</dt>
                      <dd>
                        <Copyable value={p.payout_phone?.replace("+234", "0") ?? null} label="phone number" />
                      </dd>
                    </>
                  )}
                </dl>
                <RewardActions r={p} back={BACK} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panel} aria-labelledby="open-title">
        <h2 id="open-title" className="h-display mb-1 text-lg">
          Awarded, not claimed yet ({open.length})
        </h2>
        <p className="mb-3 text-xs text-muted">
          Hidden: the user sees &quot;Amount revealed soon&quot; and can&apos;t claim. Reveal to let them claim. Amounts can change until
          they claim.
        </p>
        {open.length === 0 ? (
          <p className="text-sm text-muted">Nothing waiting.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {[...groups.entries()].map(([batch, rows]) => {
              const hidden = rows.filter((r) => r.status === "hidden");
              const total = rows.reduce((s, r) => s + (r.amount_ngn ?? 0), 0);
              return (
                <div key={batch || "single"} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                    <div className="text-sm">
                      <b>{batch ? `Award of ${formatJoined(rows[rows.length - 1].created_at)}` : "Single awards"}</b>
                      <span className="text-muted">
                        {" "}
                        · {rows.length} {rows.length === 1 ? "reward" : "rewards"} · {formatNgn(total)} · {hidden.length} hidden
                      </span>
                      {batch && <span className="block text-xs text-faint">{batch}</span>}
                    </div>
                    {batch && hidden.length > 0 && (
                      <form action={revealBatch}>
                        <input type="hidden" name="batch_id" value={batch} />
                        <input type="hidden" name="back" value={BACK} />
                        <button className={btn}>Reveal all hidden rewards in this batch</button>
                      </form>
                    )}
                  </div>
                  <ul className="flex flex-col divide-y divide-line">
                    {rows.map((r) => (
                      <li key={r.id} className="flex flex-col gap-1.5 py-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/admin/users/${r.user_id}`} className="font-bold underline">
                            {r.nickname}
                          </Link>
                          <StatusPill status={r.status} />
                          <span className="text-muted">{amountLabel(r)}</span>
                        </div>
                        <RewardActions r={r} back={BACK} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {rejected.length > 0 && (
        <section className={panel}>
          <h2 className="h-display mb-3 text-lg">Rejected</h2>
          <ul className="flex flex-col divide-y divide-line">
            {rejected.map((r) => (
              <li key={r.id} className="flex flex-col gap-1.5 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/users/${r.user_id}`} className="font-bold underline">
                    {r.nickname}
                  </Link>
                  <span className="text-muted">
                    {r.title} · {amountLabel(r)}
                  </span>
                </div>
                <RewardActions r={r} back={BACK} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {paid.length > 0 && (
        <section className={panel}>
          <h2 className="h-display mb-3 text-lg">Recently paid</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {paid.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-2">
                <Link href={`/admin/users/${r.user_id}`} className="font-bold underline">
                  {r.nickname}
                </Link>
                <span>{amountLabel(r)}</span>
                <span className="text-muted">
                  · {r.title} · {r.paid_at ? formatJoined(r.paid_at) : "–"} · ref {r.payment_reference}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
    </>
  );
}
