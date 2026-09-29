import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { ranked } from "@/lib/ranking";
import { getAnnouncementSettings, getFirstNMode, getPrizeText, getPublicStats } from "@/lib/stats";
import { formatNumber, timeAgo } from "@/lib/util";
import { normalizeNigerianPhone } from "@/lib/validate";
import {
  addReward,
  adminRemovePhoto,
  approveVerification,
  markRewardSent,
  rejectVerification,
  renameUser,
  resetPin,
  revokeVerification,
  saveAnnouncement,
  saveSettings,
  setBan,
  setFlag,
} from "@/app/actions/admin";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  nickname: string;
  whatsapp_e164: string | null;
  email: string | null;
  state: string | null;
  completed_at: Date | null;
  created_at: Date;
  position: number | null;
  refs: number | null;
  referrer: string | null;
  is_flagged: boolean;
  is_banned: boolean;
  is_seed: boolean;
  verification_status: string;
  state_code: string | null;
  photo_version: number;
};

type PendingRow = {
  id: string;
  nickname: string;
  state: string | null;
  state_code: string | null;
  whatsapp_e164: string | null;
  verification_requested_at: Date;
  position: number | null;
  refs: number | null;
  same_code: number;
};

const btn = "rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold hover:bg-surface-2";
const input = "h-9 rounded-lg border border-line bg-bg px-2.5 text-sm";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string; reset?: string; pin?: string }> }) {
  await requireAdmin();
  const { q = "", reset, pin } = await searchParams;
  const search = q.trim();
  const phone = normalizeNigerianPhone(search);
  const like = `%${search}%`;

  const [stats, prizeText, mode, announcement, overview, daily, users, fastReferrers, sharedIps, pendingRewards, pendingVerifications, verifiedCount] = await Promise.all([
    getPublicStats(),
    getPrizeText(),
    getFirstNMode(),
    getAnnouncementSettings(),
    sql<{ referred: number; completed: number; referrers: number; incomplete: number }[]>`
      SELECT count(*) FILTER (WHERE referred_by IS NOT NULL AND completed_at IS NOT NULL)::int AS referred,
             count(*) FILTER (WHERE completed_at IS NOT NULL)::int AS completed,
             count(DISTINCT referred_by) FILTER (WHERE completed_at IS NOT NULL)::int AS referrers,
             count(*) FILTER (WHERE completed_at IS NULL)::int AS incomplete
      FROM users WHERE NOT is_banned
    `,
    sql<{ day: string; n: number }[]>`
      SELECT to_char(d, 'DD Mon') AS day,
             (SELECT count(*) FROM users u
              WHERE u.completed_at IS NOT NULL AND NOT u.is_banned
                AND (u.completed_at AT TIME ZONE 'Africa/Lagos')::date = d::date)::int AS n
      FROM generate_series((now() AT TIME ZONE 'Africa/Lagos')::date - 13, (now() AT TIME ZONE 'Africa/Lagos')::date, interval '1 day') d
      ORDER BY d
    `,
    sql<UserRow[]>`
      ${ranked()}
      SELECT u.id, u.nickname, u.whatsapp_e164, u.email, u.state, u.completed_at, u.created_at,
             r.position, r.refs, ref.nickname AS referrer, u.is_flagged, u.is_banned, u.photo_version,
             u.is_seed, u.verification_status, u.state_code
      FROM users u
      LEFT JOIN ranked r ON r.id = u.id
      LEFT JOIN users ref ON ref.id = u.referred_by
      WHERE ${
        search
          ? sql`(u.nickname ILIKE ${like} OR u.email ILIKE ${like} OR u.referral_code = ${search.toLowerCase()} OR u.whatsapp_e164 = ${phone ?? "-"})`
          : sql`true`
      }
      ORDER BY u.created_at DESC
      LIMIT 50
    `,
    sql<{ id: string; nickname: string; n: number; last_hour: number }[]>`
      SELECT ref.id, ref.nickname, count(*)::int AS n,
             count(*) FILTER (WHERE u.completed_at > now() - interval '1 hour')::int AS last_hour
      FROM users u JOIN users ref ON ref.id = u.referred_by
      WHERE u.completed_at > now() - interval '24 hours' AND NOT ref.is_flagged AND NOT ref.is_banned
      GROUP BY ref.id, ref.nickname
      HAVING count(*) FILTER (WHERE u.completed_at > now() - interval '1 hour') >= 5 OR count(*) >= 15
      ORDER BY n DESC LIMIT 20
    `,
    sql<{ signup_ip_hash: string; n: number; names: string }[]>`
      SELECT signup_ip_hash, count(*)::int AS n, string_agg(nickname, ', ' ORDER BY created_at) AS names
      FROM users WHERE signup_ip_hash IS NOT NULL AND created_at > now() - interval '7 days'
      GROUP BY signup_ip_hash HAVING count(*) >= 3
      ORDER BY n DESC LIMIT 20
    `,
    sql<{ id: string; title: string; nickname: string; whatsapp_e164: string | null; created_at: Date }[]>`
      SELECT r.id, r.title, u.nickname, u.whatsapp_e164, r.created_at
      FROM rewards r JOIN users u ON u.id = r.user_id
      WHERE r.status = 'pending' ORDER BY r.created_at LIMIT 100
    `,
    sql<PendingRow[]>`
      ${ranked()}
      SELECT u.id, u.nickname, u.state, u.state_code, u.whatsapp_e164, u.verification_requested_at, r.position, r.refs,
             (SELECT count(*)::int FROM users o WHERE o.state_code = u.state_code AND o.id <> u.id) AS same_code
      FROM users u LEFT JOIN ranked r ON r.id = u.id
      WHERE u.verification_status = 'pending'
      ORDER BY r.position NULLS LAST, u.verification_requested_at
      LIMIT 50
    `,
    sql<{ n: number }[]>`SELECT count(*)::int AS n FROM users WHERE verification_status = 'verified'`,
  ]);

  const o = overview[0];
  const pctReferred = o.completed ? Math.round((o.referred / o.completed) * 100) : 0;
  const avgRefs = o.referrers ? (o.referred / o.referrers).toFixed(1) : "0";
  const maxDay = Math.max(1, ...daily.map((d) => d.n));

  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-8 px-5 py-8">
      <header className="flex items-center justify-between">
        <h1 className="h-display text-3xl">Admin</h1>
        <Link href="/home" className="text-sm font-bold text-lime-ink">
          Back to app
        </Link>
      </header>

      {reset && pin && /^\d{4}$/.test(pin) && (
        <p role="status" className="rounded-2xl border border-lime p-4 text-sm">
          Temporary PIN for <b>{reset}</b>: <b className="text-lime-ink">{pin}</b>. Send it to them on WhatsApp and ask them to change it in
          their profile.
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Corpers joined", formatNumber(stats.total)],
          ["Joined today", formatNumber(stats.today)],
          ["From referrals", `${pctReferred}%`],
          ["Avg referrals per referrer", avgRefs],
          ["Unfinished Google sign-ups", formatNumber(o.incomplete)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-surface p-4">
            <div className="text-xs text-muted">{label}</div>
            <div className="h-display mt-1 text-2xl">{value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-surface p-5">
          <h2 className="h-display mb-3 text-lg">Sign-ups, last 14 days</h2>
          <ul className="flex flex-col gap-1.5">
            {daily.map((d) => (
              <li key={d.day} className="flex items-center gap-3 text-sm">
                <span className="w-14 shrink-0 text-muted">{d.day}</span>
                <span className="h-3 rounded-sm bg-lime" style={{ width: `${(d.n / maxDay) * 70}%`, minWidth: d.n ? 3 : 0 }} />
                <span className="text-muted">{d.n}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-surface p-5">
          <h2 className="h-display mb-3 text-lg">Top states</h2>
          <ol className="flex flex-col gap-1 text-sm">
            {stats.states.slice(0, 10).map((s) => (
              <li key={s.state} className="flex justify-between">
                <span>
                  {s.rank}. {s.state}
                </span>
                <span className="text-muted">{formatNumber(s.count)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-5">
        <h2 className="h-display mb-3 text-lg">Prizes and exports</h2>
        <form action={saveSettings} className="flex flex-col gap-3">
          <label className="text-sm text-muted" htmlFor="prize">
            Prize text (shown on Landing, Home and Rewards)
          </label>
          <textarea id="prize" name="prize_teaser_text" defaultValue={prizeText} rows={2} maxLength={300} className="rounded-lg border border-line bg-bg p-3 text-sm" />
          <label className="flex items-center gap-2 text-sm">
            First 500 is counted by
            <select name="first_n_mode" defaultValue={mode} className={input}>
              <option value="position">position on the list</option>
              <option value="signup">sign-up order</option>
            </select>
          </label>
          <button type="submit" className="self-start rounded-full bg-lime px-5 py-2 text-sm font-bold text-on-accent">
            Save
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/admin/export?list=first" className={btn}>
            Download first 500 verified (CSV)
          </a>
          <a href="/admin/export?list=referrers" className={btn}>
            Download top 10 verified referrers (CSV)
          </a>
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-5">
        <h2 className="h-display mb-1 text-lg">Verification requests ({pendingVerifications.length})</h2>
        <p className="mb-3 text-xs text-muted">
          {verifiedCount[0].n} verified so far. Check the name, state and state code on the ID card. Highest positions first. The photo is
          deleted when you approve or reject.
        </p>
        {pendingVerifications.length === 0 ? (
          <p className="text-sm text-muted">No requests waiting.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {pendingVerifications.map((v) => (
              <li key={v.id} className="flex flex-col gap-3 rounded-xl border border-line p-3">
                <a href={`/admin/id-card/${v.id}`} target="_blank" rel="noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/admin/id-card/${v.id}`} alt={`ID card sent by ${v.nickname}`} className="max-h-64 w-full rounded-lg bg-bg object-contain" />
                </a>
                <div className="text-sm">
                  <div className="font-bold">
                    {v.nickname} · {v.state ?? "–"}
                  </div>
                  <div className="text-muted">
                    State code <b className="text-ink">{v.state_code}</b>
                    {v.same_code > 0 && <span className="text-pink-ink"> · used by {v.same_code} other account(s)</span>}
                  </div>
                  <div className="text-muted">
                    #{v.position ?? "–"} · {v.refs ?? 0} refs · {v.whatsapp_e164 ?? "no WhatsApp"} · sent {timeAgo(v.verification_requested_at)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={approveVerification}>
                    <input type="hidden" name="id" value={v.id} />
                    <button className="rounded-full bg-lime px-4 py-1.5 text-sm font-bold text-on-accent">Approve</button>
                  </form>
                  <form action={rejectVerification} className="flex flex-1 gap-1.5">
                    <input type="hidden" name="id" value={v.id} />
                    <input name="note" maxLength={200} placeholder="Reason (shown to them)" className={`${input} min-w-0 flex-1`} />
                    <button className={btn}>Reject</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-surface p-5">
        <h2 className="h-display mb-1 text-lg">Announcement</h2>
        <p className="mb-3 text-xs text-muted">A pink slide in the carousel at the top of Home. Hidden when switched off or the title is empty.</p>
        <form action={saveAnnouncement} className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="announcement_active" value="1" defaultChecked={announcement.active} className="size-4 accent-lime" />
            Show on Home
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Title
            <input name="announcement_title" defaultValue={announcement.title} maxLength={60} className={`${input} text-ink`} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Text
            <textarea
              name="announcement_body"
              defaultValue={announcement.body}
              rows={2}
              maxLength={200}
              className="rounded-lg border border-line bg-bg p-3 text-sm text-ink"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
            <label className="flex flex-col gap-1 text-sm text-muted">
              Button label (optional)
              <input name="announcement_button_label" defaultValue={announcement.buttonLabel} maxLength={24} className={`${input} text-ink`} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Button link: starts with / or https://
              <input
                name="announcement_button_url"
                defaultValue={announcement.buttonUrl}
                maxLength={300}
                placeholder="/invite"
                pattern="(/[^/].*|/|https://.+)"
                className={`${input} text-ink`}
              />
            </label>
          </div>
          <button type="submit" className="self-start rounded-full bg-lime px-5 py-2 text-sm font-bold text-on-accent">
            Save
          </button>
        </form>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-surface p-5">
          <h2 className="h-display mb-1 text-lg">Fast referrers</h2>
          <p className="mb-3 text-xs text-muted">5+ referrals in the last hour, or 15+ in 24 hours.</p>
          {fastReferrers.length === 0 ? (
            <p className="text-sm text-muted">Nothing suspicious.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {fastReferrers.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span>
                    <Link href={`/admin?q=${encodeURIComponent(r.nickname)}`} className="font-bold underline">
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
        <div className="rounded-2xl bg-surface p-5">
          <h2 className="h-display mb-1 text-lg">Many sign-ups, same network</h2>
          <p className="mb-3 text-xs text-muted">3+ accounts from one network in 7 days. Could be a shared camp Wi-Fi.</p>
          {sharedIps.length === 0 ? (
            <p className="text-sm text-muted">Nothing suspicious.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {sharedIps.map((r) => (
                <li key={r.signup_ip_hash}>
                  <span className="font-bold">{r.n} accounts:</span> <span className="text-muted">{r.names}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-5">
        <h2 className="h-display mb-3 text-lg">Pending rewards</h2>
        {pendingRewards.length === 0 ? (
          <p className="text-sm text-muted">No pending rewards. Add one from the users table below.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {pendingRewards.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span>
                  <span className="font-bold">{r.title}</span> → {r.nickname}{" "}
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

      <section className="flex flex-col gap-3">
        <form className="flex gap-2">
          <input name="q" defaultValue={search} placeholder="Search nickname, phone, email or referral code" className={`${input} flex-1`} />
          <button className="rounded-lg bg-lime px-4 text-sm font-bold text-on-accent">Search</button>
        </form>
        <div className="overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-surface-2">
                <th className="p-3">User</th>
                <th className="p-3">Contact</th>
                <th className="p-3">State</th>
                <th className="p-3">Pos.</th>
                <th className="p-3">Refs</th>
                <th className="p-3">Invited by</th>
                <th className="p-3">Joined</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-surface-2 align-top">
                  <td className="p-3">
                    <div className="font-bold">{u.nickname}</div>
                    <div className="flex gap-1 pt-1">
                      {u.is_flagged && <span className="rounded bg-pink px-1.5 text-xs font-bold text-on-accent">Flagged</span>}
                      {u.is_banned && <span className="rounded bg-ink px-1.5 text-xs font-bold text-bg">Banned</span>}
                      {!u.completed_at && <span className="rounded bg-surface-2 px-1.5 text-xs">Unfinished</span>}
                      {u.is_seed && <span className="rounded bg-surface-2 px-1.5 text-xs">Seed</span>}
                      {u.verification_status === "verified" && (
                        <span className="rounded bg-lime px-1.5 text-xs font-bold text-on-accent">Verified</span>
                      )}
                      {u.verification_status === "pending" && <span className="rounded bg-surface-2 px-1.5 text-xs">Pending check</span>}
                    </div>
                  </td>
                  <td className="p-3 text-muted">
                    <div>{u.whatsapp_e164 ?? "–"}</div>
                    <div className="text-xs">{u.email}</div>
                  </td>
                  <td className="p-3">
                    {u.state ?? "–"}
                    {u.state_code && <div className="text-xs text-muted">{u.state_code}</div>}
                  </td>
                  <td className="p-3">{u.position ?? "–"}</td>
                  <td className="p-3">{u.refs ?? 0}</td>
                  <td className="p-3 text-muted">{u.referrer ?? "–"}</td>
                  <td className="p-3 text-muted">{timeAgo(u.completed_at ?? u.created_at)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      <form action={setFlag}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="on" value={u.is_flagged ? "0" : "1"} />
                        <button className={btn}>{u.is_flagged ? "Unflag" : "Flag"}</button>
                      </form>
                      <form action={setBan}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="on" value={u.is_banned ? "0" : "1"} />
                        <button className={btn}>{u.is_banned ? "Unban" : "Ban"}</button>
                      </form>
                      {u.whatsapp_e164 && (
                        <form action={resetPin}>
                          <input type="hidden" name="id" value={u.id} />
                          <button className={btn}>Reset PIN</button>
                        </form>
                      )}
                      {u.verification_status === "verified" && (
                        <form action={revokeVerification}>
                          <input type="hidden" name="id" value={u.id} />
                          <button className={btn}>Remove verification</button>
                        </form>
                      )}
                      {u.photo_version > 0 && (
                        <form action={adminRemovePhoto}>
                          <input type="hidden" name="id" value={u.id} />
                          <button className={btn}>Remove photo</button>
                        </form>
                      )}
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-lime-ink">Rename or add reward</summary>
                      <form action={renameUser} className="mt-2 flex gap-1.5">
                        <input type="hidden" name="id" value={u.id} />
                        <input name="nickname" defaultValue={u.nickname} className={`${input} w-32`} />
                        <button className={btn}>Rename</button>
                      </form>
                      <form action={addReward} className="mt-2 flex gap-1.5">
                        <input type="hidden" name="id" value={u.id} />
                        <input name="title" placeholder="₦1,000 airtime" className={`${input} w-32`} />
                        <button className={btn}>Add reward</button>
                      </form>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <p className="p-5 text-sm text-muted">No users found.</p>}
        </div>
      </section>
    </main>
  );
}
