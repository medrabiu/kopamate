import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, GiftIcon } from "@/components/icons";
import { requireUser } from "@/lib/session";
import { getRank, getReferrerRank } from "@/lib/ranking";
import { getFirstNMode, getPrizeText } from "@/lib/stats";
import { FIRST_N, TOP_REFERRERS } from "@/lib/config";
import { sql } from "@/lib/db";
import { formatJoined, formatNumber } from "@/lib/util";

export const metadata: Metadata = { title: "Rewards" };

export default async function RewardsPage() {
  const user = await requireUser();
  const [rank, refRank, mode, prizeText, rewards] = await Promise.all([
    getRank(user.id),
    getReferrerRank(user.id),
    getFirstNMode(),
    getPrizeText(),
    sql<{ id: string; title: string; description: string | null; status: string; created_at: Date; sent_at: Date | null }[]>`
      SELECT id, title, description, status, created_at, sent_at FROM rewards WHERE user_id = ${user.id} ORDER BY created_at DESC
    `,
  ]);

  const firstNValue = mode === "signup" ? user.signup_number ?? 0 : rank?.position ?? 0;
  const inFirstN = firstNValue > 0 && firstNValue <= FIRST_N;
  const inTopRefs = Boolean(refRank && refRank.rank <= TOP_REFERRERS);

  return (
    <>
      <h1 className="h-display text-[28px]">Rewards</h1>

      <section className="flex flex-col gap-2 rounded-3xl bg-pink p-[22px] text-bg">
        <h2 className="h-display text-[26px] leading-tight">Prizes are coming</h2>
        <p className="text-[15px] font-medium leading-normal">{prizeText}</p>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="h-display text-xl">Where you stand</h2>
        <div className="flex items-center gap-3.5 rounded-[18px] bg-surface p-4">
          {inFirstN ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime text-bg">
              <CheckIcon size={20} strokeWidth={2.5} />
            </span>
          ) : (
            <span className="h-display flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px]">
              {firstNValue > 999 ? "999+" : firstNValue}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-bold">First {FIRST_N} {mode === "signup" ? "signups" : "on the list"}</div>
            <div className="text-sm text-muted">
              {inFirstN
                ? `You're in at #${formatNumber(firstNValue)}`
                : mode === "signup"
                  ? `You joined as #${formatNumber(firstNValue)}`
                  : `You're #${formatNumber(firstNValue)}. Invite friends to get into the first ${FIRST_N}.`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3.5 rounded-[18px] bg-surface p-4">
          {inTopRefs ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime text-bg">
              <CheckIcon size={20} strokeWidth={2.5} />
            </span>
          ) : (
            <span className="h-display flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm">
              {refRank ? refRank.rank : "–"}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-bold">Top {TOP_REFERRERS} referrers</div>
            <div className="text-sm text-muted">
              {inTopRefs
                ? `You're #${refRank!.rank} with ${refRank!.refs} referrals`
                : refRank
                  ? `You're #${refRank.rank}. Invite more to climb.`
                  : "Invite your first friend to get on the board."}
            </div>
          </div>
          <Link href="/invite" className="py-2.5 text-sm font-bold text-lime">
            Invite
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="h-display text-xl">Your rewards</h2>
        {rewards.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 rounded-[20px] border-[1.5px] border-dashed border-line px-5 py-7 text-center">
            <GiftIcon size={32} strokeWidth={1.8} className="text-faint" />
            <p className="font-bold">Rewards you win show up here</p>
            <p className="text-sm leading-normal text-muted">
              Prizes are sent as airtime, data or bank transfer. We&apos;ll message you on WhatsApp.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {rewards.map((r) => (
              <li key={r.id} className="flex items-center gap-3.5 rounded-[18px] bg-surface p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-pink">
                  <GiftIcon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{r.title}</div>
                  {r.description && <div className="text-sm text-muted">{r.description}</div>}
                  <div className="text-xs text-faint">{formatJoined(r.created_at)}</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    r.status === "sent" ? "bg-lime text-bg" : "bg-surface-2 text-muted"
                  }`}
                >
                  {r.status === "sent" ? "Sent" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
