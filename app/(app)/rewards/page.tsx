import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, ChevronRight, GiftIcon } from "@/components/icons";
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

  const verified = user.verification_status === "verified";
  // Prizes count verified users only, so once verified you're compared with other verified corpers.
  const firstNValue = verified
    ? (mode === "signup" ? rank?.prize_signup : rank?.prize_position) ?? 0
    : mode === "signup" ? user.signup_number ?? 0 : rank?.position ?? 0;
  const inFirstN = verified && firstNValue > 0 && firstNValue <= FIRST_N;
  const refPrizeRank = refRank?.prize_rank ?? null;
  const inTopRefs = verified && refPrizeRank !== null && refPrizeRank <= TOP_REFERRERS;
  const verifyText =
    user.verification_status === "pending"
      ? "We're checking your ID. You'll qualify once you're verified."
      : user.verification_status === "rejected"
        ? "Your verification needs another try. Open Profile to see why."
        : "Add your state code and NYSC ID card in Profile. Only verified corpers win prizes.";

  return (
    <>
      <h1 className="h-display text-[28px]">Rewards</h1>

      <section className="flex flex-col gap-2 rounded-3xl bg-pink p-[22px] text-on-accent">
        <h2 className="h-display text-[26px] leading-tight">Prizes are coming</h2>
        <p className="text-[15px] font-medium leading-normal">{prizeText}</p>
      </section>

      {!verified && (
        <Link href="/profile#verify" className="flex items-center gap-3.5 rounded-[18px] border-[1.5px] border-lime p-4">
          <div className="min-w-0 flex-1">
            <div className="font-bold">{user.verification_status === "pending" ? "Verification in progress" : "Get verified to win"}</div>
            <div className="text-sm text-muted">{verifyText}</div>
          </div>
          <ChevronRight size={20} className="shrink-0 text-lime-ink" />
        </Link>
      )}

      <section className="flex flex-col gap-2.5">
        <h2 className="h-display text-xl">Where you stand</h2>
        <div className="flex items-center gap-3.5 rounded-[18px] bg-surface p-4">
          {inFirstN ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime text-on-accent">
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
                ? `You're in at #${formatNumber(firstNValue)} among verified corpers`
                : verified && firstNValue > 0
                  ? `You're #${formatNumber(firstNValue)} among verified corpers. Invite friends to get into the first ${FIRST_N}.`
                  : mode === "signup"
                  ? `You joined as #${formatNumber(firstNValue)}`
                  : `You're #${formatNumber(firstNValue)}. Invite friends to get into the first ${FIRST_N}.`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3.5 rounded-[18px] bg-surface p-4">
          {inTopRefs ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime text-on-accent">
              <CheckIcon size={20} strokeWidth={2.5} />
            </span>
          ) : (
            <span className="h-display flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm">
              {verified ? refPrizeRank ?? "–" : refRank ? refRank.rank : "–"}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-bold">Top {TOP_REFERRERS} referrers</div>
            <div className="text-sm text-muted">
              {inTopRefs
                ? `You're #${refPrizeRank} among verified referrers with ${refRank!.refs} referrals`
                : refRank
                  ? `You're #${verified ? refPrizeRank : refRank.rank}${verified ? " among verified referrers" : ""}. Invite more to climb.`
                  : "Invite your first friend to get on the board."}
            </div>
          </div>
          <Link href="/invite" className="py-2.5 text-sm font-bold text-lime-ink">
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
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-pink-ink">
                  <GiftIcon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{r.title}</div>
                  {r.description && <div className="text-sm text-muted">{r.description}</div>}
                  <div className="text-xs text-faint">{formatJoined(r.created_at)}</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    r.status === "sent" ? "bg-lime text-on-accent" : "bg-surface-2 text-muted"
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
