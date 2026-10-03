import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import { requireAdmin } from "@/lib/session";
import { sql } from "@/lib/db";
import { ranked } from "@/lib/ranking";
import { STATES } from "@/lib/states";
import { formatJoined, timeAgo } from "@/lib/util";
import BadgeChip from "@/components/BadgeChip";
import { awardReward } from "@/app/actions/admin-rewards";
import { getBudget, getMoneySettings } from "@/lib/rewards";
import { formatNgn, KIND_LABEL, maskAccount, REWARD_KINDS } from "@/lib/reward-meta";
import { Notice, RewardActions, StatusPill, type AdminReward } from "../../rewards/parts";
import {
  adminAwardBadge,
  adminDeleteUser,
  adminRestoreBadge,
  adminRevokeBadge,
  adminRemovePhoto,
  adminUpdateUser,
  allowVerificationRetry,
  approveVerification,
  rejectVerification,
  resetPin,
  revokeVerification,
  setBan,
  setFlag,
} from "@/app/actions/admin";
import { btn, btnPrimary, input, panel } from "../../ui";
import { StatusBadges } from "../../badges";
import VerificationSignals from "../../VerificationSignals";

export const metadata: Metadata = { title: "User" };

type Detail = {
  id: string;
  nickname: string;
  full_name: string | null;
  whatsapp_e164: string | null;
  email: string | null;
  state: string | null;
  state_code: string | null;
  referral_code: string;
  photo_version: number;
  signup_number: number | null;
  completed_at: Date | null;
  created_at: Date;
  is_flagged: boolean;
  is_banned: boolean;
  is_seed: boolean;
  show_in_list: boolean;
  verification_status: string;
  verification_note: string | null;
  verified_at: Date | null;
  has_id_card: boolean;
  has_pin: boolean;
  google: boolean;
  position: number | null;
  refs: number | null;
  prize_position: number | null;
  referrer_id: string | null;
  referrer: string | null;
};

export default async function AdminUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const { pin } = sp;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [rows, referred, rewards, badges, settings, events] = await Promise.all([
    sql<Detail[]>`
      ${ranked()}
      SELECT u.id, u.nickname, u.full_name, u.whatsapp_e164, u.email, u.state, u.state_code, u.referral_code, u.photo_version,
             u.signup_number, u.completed_at, u.created_at, u.is_flagged, u.is_banned, u.is_seed, u.show_in_list,
             u.verification_status, u.verification_note, u.verified_at, (u.id_card_data IS NOT NULL) AS has_id_card,
             (u.pin_hash IS NOT NULL) AS has_pin, (u.google_id IS NOT NULL) AS google,
             r.position, r.refs, r.prize_position, ref.id AS referrer_id, ref.nickname AS referrer
      FROM users u
      LEFT JOIN ranked r ON r.id = u.id
      LEFT JOIN users ref ON ref.id = u.referred_by
      WHERE u.id = ${id}
    `,
    sql<{ id: string; nickname: string; completed_at: Date | null; is_flagged: boolean; is_banned: boolean }[]>`
      SELECT id, nickname, completed_at, is_flagged, is_banned FROM users
      WHERE referred_by = ${id} ORDER BY created_at DESC LIMIT 50
    `,
    sql<
      (AdminReward & {
        description: string | null;
        payout_bank: string | null;
        payout_account_number: string | null;
        payout_account_name: string | null;
        payout_phone: string | null;
      })[]
    >`
      SELECT id, title, description, kind, status, amount_ngn, admin_note, payment_reference, paid_at, created_at,
             payout_bank, payout_account_number, payout_account_name, payout_phone
      FROM rewards WHERE user_id = ${id} ORDER BY created_at DESC
    `,
    sql<
      {
        slug: string;
        name: string;
        icon: string;
        color: string;
        kind: string;
        awarded_at: Date | null;
        awarded_by: string | null;
        revoked_at: Date | null;
        revoked_reason: string | null;
      }[]
    >`
      SELECT b.slug, b.name, b.icon, b.color, b.kind, ub.awarded_at, ub.awarded_by, ub.revoked_at, ub.revoked_reason
      FROM badges b LEFT JOIN user_badges ub ON ub.badge_slug = b.slug AND ub.user_id = ${id}
      ORDER BY b.priority DESC
    `,
    getMoneySettings(),
    sql<{ reward_id: string; actor: string; action: string; detail: Record<string, unknown> | null; created_at: Date }[]>`
      SELECT e.reward_id, e.actor, e.action, e.detail, e.created_at
      FROM reward_events e JOIN rewards r ON r.id = e.reward_id
      WHERE r.user_id = ${id} ORDER BY e.created_at DESC LIMIT 100
    `,
  ]);
  const budget = await getBudget(settings);
  const userTotal = rewards.reduce((s, r) => s + (r.status !== "rejected" ? r.amount_ngn ?? 0 : 0), 0);
  const back = `/admin/users/${id}`;
  const u = rows[0];
  if (!u) notFound();
  const isSelf = u.id === admin.id;

  return (
    <>
      <Link href="/admin/users" className="text-sm text-muted hover:text-ink">
        ← All users
      </Link>
      <Notice params={sp} />

      {pin && /^\d{4}$/.test(pin) && (
        <p role="status" className="rounded-2xl border border-lime p-4 text-sm">
          Temporary PIN for <b>{u.nickname}</b>: <b className="text-lime-ink">{pin}</b>. Send it to them on WhatsApp and ask them to
          change it in their profile. It won&apos;t be shown again.
        </p>
      )}

      <section className={`${panel} flex flex-wrap items-start gap-4`}>
        <Avatar id={u.id} nickname={u.nickname} photoVersion={u.photo_version} size={72} />
        <div className="min-w-0 flex-1">
          <h2 className="h-display text-2xl">{u.nickname}</h2>
          <StatusBadges user={u} />
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Full name</dt>
            <dd>{u.full_name ?? "–"}</dd>
            <dt className="text-muted">WhatsApp</dt>
            <dd>{u.whatsapp_e164 ?? "–"}</dd>
            <dt className="text-muted">Email</dt>
            <dd>{u.email ?? "–"}</dd>
            <dt className="text-muted">Sign-in</dt>
            <dd>{[u.google && "Google", u.has_pin && "PIN"].filter(Boolean).join(" + ") || "–"}</dd>
            <dt className="text-muted">State</dt>
            <dd>
              {u.state ?? "–"} {u.state_code && <span className="text-muted">· {u.state_code}</span>}
            </dd>
            <dt className="text-muted">Position</dt>
            <dd>
              {u.position ? `#${u.position}` : "Not ranked"}
              {u.prize_position && <span className="text-muted"> · #{u.prize_position} among verified</span>}
            </dd>
            <dt className="text-muted">Referrals</dt>
            <dd>{u.refs ?? 0}</dd>
            <dt className="text-muted">Invited by</dt>
            <dd>
              {u.referrer_id ? (
                <Link href={`/admin/users/${u.referrer_id}`} className="underline">
                  {u.referrer}
                </Link>
              ) : (
                "–"
              )}
            </dd>
            <dt className="text-muted">Joined</dt>
            <dd>
              {u.completed_at ? `${formatJoined(u.completed_at)} (sign-up #${u.signup_number})` : `Unfinished, started ${timeAgo(u.created_at)}`}
            </dd>
            <dt className="text-muted">Referral code</dt>
            <dd>{u.referral_code}</dd>
            <dt className="text-muted">In Corpers list</dt>
            <dd>{u.show_in_list ? "Shown" : "Hidden by them"}</dd>
          </dl>
        </div>
      </section>

      <section className={panel}>
        <h2 className="h-display mb-3 text-lg">Moderation</h2>
        <div className="flex flex-wrap gap-2">
          <form action={setFlag}>
            <input type="hidden" name="id" value={u.id} />
            <input type="hidden" name="on" value={u.is_flagged ? "0" : "1"} />
            <button className={btn}>{u.is_flagged ? "Unflag" : "Flag (referrals stop counting)"}</button>
          </form>
          {!isSelf && (
            <form action={setBan}>
              <input type="hidden" name="id" value={u.id} />
              <input type="hidden" name="on" value={u.is_banned ? "0" : "1"} />
              <button className={btn}>{u.is_banned ? "Unban" : "Ban (signs them out)"}</button>
            </form>
          )}
          {u.whatsapp_e164 && (
            <form action={resetPin}>
              <input type="hidden" name="id" value={u.id} />
              <button className={btn}>Reset PIN</button>
            </form>
          )}
          {u.photo_version > 0 && (
            <form action={adminRemovePhoto}>
              <input type="hidden" name="id" value={u.id} />
              <button className={btn}>Remove photo</button>
            </form>
          )}
        </div>
      </section>

      <section className={panel}>
        <h2 className="h-display mb-3 text-lg">Edit</h2>
        <form action={adminUpdateUser} className="grid gap-3 md:grid-cols-3">
          <input type="hidden" name="id" value={u.id} />
          <label className="flex flex-col gap-1 text-sm text-muted">
            Username
            <input name="nickname" defaultValue={u.nickname} maxLength={20} required className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            State
            <select name="state" defaultValue={u.state ?? ""} className={input}>
              <option value="">–</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            State code
            <input name="state_code" defaultValue={u.state_code ?? ""} maxLength={16} placeholder="EN/26B/1234" className={input} />
          </label>
          <button className={`${btnPrimary} self-start`}>Save changes</button>
        </form>
      </section>

      <section className={panel}>
        <h2 className="h-display mb-3 text-lg">Verification</h2>
        {u.verification_status === "pending" ? (
          <div className="flex flex-col gap-3">
            {u.has_id_card && (
              <a href={`/admin/id-card/${u.id}`} target="_blank" rel="noopener" className="self-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/admin/id-card/${u.id}`} alt={`ID card sent by ${u.nickname}`} className="max-h-72 rounded-lg bg-bg object-contain" />
              </a>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <form action={approveVerification}>
                <input type="hidden" name="id" value={u.id} />
                <button className={btnPrimary}>Approve</button>
              </form>
              <form action={rejectVerification} className="flex min-w-[280px] flex-1 flex-wrap gap-1.5">
                <input type="hidden" name="id" value={u.id} />
                <input name="note" maxLength={200} placeholder="Reason (shown to them)" className={`${input} min-w-0 flex-1`} />
                <button className={btn}>Reject</button>
                <label className="flex w-full items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" name="block_code" value="1" className="accent-pink" />
                  Fake state code: block it for every account
                </label>
              </form>
            </div>
          </div>
        ) : u.verification_status === "verified" ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>Verified {u.verified_at ? timeAgo(u.verified_at) : ""}</span>
            <form action={revokeVerification}>
              <input type="hidden" name="id" value={u.id} />
              <button className={btn}>Remove verification</button>
            </form>
          </div>
        ) : (
          <p className="text-sm text-muted">
            {u.verification_status === "rejected" ? `Rejected: ${u.verification_note ?? ""}` : "Hasn't asked to be verified."}
          </p>
        )}
        <div className="mt-3 flex flex-col gap-2">
          <VerificationSignals userId={u.id} />
          {u.verification_status !== "verified" && u.verification_status !== "pending" && (
            <form action={allowVerificationRetry}>
              <input type="hidden" name="id" value={u.id} />
              <button className={btn}>Allow another try now</button>
            </form>
          )}
        </div>
      </section>

      <section className={panel}>
        <h2 className="h-display mb-1 text-lg">Badges</h2>
        <p className="mb-3 text-xs text-muted">
          {u.is_flagged || u.is_banned
            ? "Hidden while this user is flagged or banned, and they never count for rewards."
            : "Auto badges are given by the system; Prophet and State Ambassador are given here."}
        </p>
        <ul className="flex flex-col gap-2.5">
          {badges.map((b) => (
            <li key={b.slug} className="flex flex-wrap items-center gap-2 text-sm">
              <BadgeChip badge={b} locked={!b.awarded_at || Boolean(b.revoked_at)} />
              <span className="min-w-[160px] flex-1 text-xs text-muted">
                {b.revoked_at
                  ? `Revoked ${timeAgo(b.revoked_at)}${b.revoked_reason ? `: ${b.revoked_reason}` : ""}`
                  : b.awarded_at
                    ? `Given ${timeAgo(b.awarded_at)} by ${b.awarded_by === "system" ? "the system" : b.awarded_by === admin.id ? "you" : "an admin"}`
                    : b.kind === "auto"
                      ? "Not earned yet"
                      : "Not given"}
              </span>
              {b.awarded_at && !b.revoked_at && (
                <form action={adminRevokeBadge} className="flex gap-1.5">
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="slug" value={b.slug} />
                  <input name="reason" maxLength={200} placeholder="Reason" required className={`${input} w-44`} />
                  <button className={btn}>Revoke</button>
                </form>
              )}
              {b.revoked_at && (
                <form action={adminRestoreBadge}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="slug" value={b.slug} />
                  <button className={btn}>Restore</button>
                </form>
              )}
              {!b.awarded_at && b.kind === "manual" && (
                <form action={adminAwardBadge}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="slug" value={b.slug} />
                  <button className={btn}>Award</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className={panel}>
          <h2 className="h-display mb-1 text-lg">Rewards</h2>
          <p className="mb-3 text-xs text-muted">
            Awarded to them: {formatNgn(userTotal)}
            {settings.cap ? ` · per-user cap ${formatNgn(settings.cap)}` : " · no per-user cap"} · budget left {formatNgn(budget.remaining)}
          </p>
          {rewards.length > 0 && (
            <ul className="mb-4 flex flex-col divide-y divide-line text-sm">
              {rewards.map((r) => {
                const history = events.filter((e) => e.reward_id === r.id);
                return (
                  <li key={r.id} className="flex flex-col gap-1.5 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <b>{r.title}</b>
                      <StatusPill status={r.status} />
                      <span>{r.amount_ngn ? formatNgn(r.amount_ngn) : "No amount"}</span>
                      <span className="text-muted">
                        {KIND_LABEL[r.kind]} · {timeAgo(r.created_at)}
                      </span>
                    </div>
                    {r.description && <span className="text-xs text-muted">{r.description}</span>}
                    {(r.payout_account_number || r.payout_phone) && (
                      <span className="text-xs">
                        Pays to:{" "}
                        {r.payout_phone
                          ? r.payout_phone.replace("+234", "0")
                          : `${maskAccount(r.payout_bank, r.payout_account_number)} · ${r.payout_account_name}`}{" "}
                        <Link href="/admin/rewards" className="text-muted underline">
                          full details in Payouts
                        </Link>
                      </span>
                    )}
                    <RewardActions r={r} back={back} />
                    {history.length > 0 && (
                      <details className="text-xs text-muted">
                        <summary className="cursor-pointer">History ({history.length})</summary>
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {history.map((e, i) => (
                            <li key={i}>
                              {formatJoined(e.created_at)} {timeAgo(e.created_at)} ·{" "}
                              {e.actor === "user" ? "user" : e.actor === admin.id ? "you" : "an admin"} · {e.action.replace("_", " ")}
                              {e.detail ? ` · ${JSON.stringify(e.detail)}` : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <form action={awardReward} className="flex flex-col gap-2">
            <input type="hidden" name="user_id" value={u.id} />
            <input type="hidden" name="back" value={back} />
            {(u.is_seed || u.is_flagged || u.is_banned || u.verification_status !== "verified") && (
              <p className="rounded-lg border border-pink px-3 py-2 text-xs">
                {u.is_seed
                  ? "Seed account: never eligible for prizes. Only award it for testing."
                  : u.is_flagged || u.is_banned
                    ? "Flagged or banned: they can't claim until this is lifted."
                    : "Not verified yet. The Rewards page tells users only verified corpers win."}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <select name="kind" defaultValue="cash" aria-label="Paid as" className={input}>
                {REWARD_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <input name="amount" inputMode="numeric" placeholder="₦ amount (optional)" aria-label="Amount in naira" className={`${input} w-40`} />
            </div>
            <input name="title" required maxLength={80} placeholder="Title, e.g. Top referrer prize" aria-label="Title" className={input} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="show" value="1" className="size-4 accent-lime" />
              Show amount to user (needs an amount; off means hidden until you reveal it)
            </label>
            <button className={`${btn} self-start`}>Award reward</button>
          </form>
        </div>

        <div className={panel}>
          <h2 className="h-display mb-3 text-lg">Invited ({referred.length}{referred.length === 50 ? "+" : ""})</h2>
          {referred.length === 0 ? (
            <p className="text-sm text-muted">Nobody yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {referred.map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <Link href={`/admin/users/${r.id}`} className="underline-offset-2 hover:underline">
                    {r.nickname}
                  </Link>
                  <span className="text-muted">
                    {r.is_banned ? "Banned" : r.is_flagged ? "Flagged" : r.completed_at ? timeAgo(r.completed_at) : "Unfinished"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {!isSelf && (
        <section className="rounded-2xl border border-pink/40 p-5">
          <h2 className="h-display mb-1 text-lg">Delete account</h2>
          <p className="mb-3 text-sm text-muted">
            Removes the account, position, rewards and sessions for good. People they invited stay, but stop counting as their referrals.
          </p>
          <form action={adminDeleteUser} className="flex flex-wrap gap-2">
            <input type="hidden" name="id" value={u.id} />
            <input name="confirm" autoComplete="off" placeholder="Type DELETE" className={input} />
            <button className="rounded-full bg-pink px-4 py-1.5 text-sm font-bold text-on-accent">Delete</button>
          </form>
        </section>
      )}
    </>
  );
}
