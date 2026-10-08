import type { Metadata } from "next";
import Link from "next/link";
import BadgeCelebration from "@/components/BadgeCelebration";
import Countdown, { Deadline } from "@/components/Countdown";
import { ChevronRight, ClockIcon, GiftIcon, ShieldIcon, TrophyIcon } from "@/components/icons";
import { requireUser } from "@/lib/session";
import { getNationalLeaderboard, getReferrerStanding, getStateLeaderboard, type ReferrerRow } from "@/lib/ranking";
import { getRewardSettings } from "@/lib/stats";
import { getUserBadges } from "@/lib/badges";
import { referralLink, whatsappShareUrl } from "@/lib/config";
import { sql } from "@/lib/db";
import ReferralEarnings from "@/components/ReferralEarnings";
import { getEarnings } from "@/lib/referral-bonus";
import Tabs from "@/components/Tabs";
import { formatNgn } from "@/lib/reward-meta";
import YourRewards, { RewardHistory, type MyReward, type SavedBank } from "./YourRewards";
import { Leaderboard, Prizes, RankConfetti, type BoardRow } from "./RewardsClient";

export const metadata: Metadata = { title: "Rewards" };

const lagosDay = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));

const friends = (n: number) => `${n} ${n === 1 ? "friend" : "friends"}`;

function toBoard(r: ReferrerRow, rank: number): BoardRow {
  return { id: r.id, nickname: r.nickname, photo_version: r.photo_version, state: r.state, refs: r.refs, rank, verified: r.verified, brand: r.brand, team: r.team };
}

export default async function RewardsPage() {
  const user = await requireUser();
  const state = user.state ?? "";
  const [settings, standing, national, stateBoard, badges, rewards, saved, earnings] = await Promise.all([
    getRewardSettings(),
    getReferrerStanding(user.id),
    getNationalLeaderboard(),
    getStateLeaderboard(state),
    getUserBadges(user.id),
    // Payout details are private: this page (the owner's own) and the admin are the only places that read them.
    sql<MyReward[]>`
      SELECT id, title, description, kind, status, amount_ngn, admin_note, paid_at::text AS paid_at, created_at::text AS created_at,
             payout_bank, payout_account_number, payout_account_name, payout_phone
      FROM rewards WHERE user_id = ${user.id}
      ORDER BY (status = 'unclaimed') DESC, created_at DESC
    `,
    sql<SavedBank[]>`
      SELECT payout_bank AS bank, payout_account_number AS account_number, payout_account_name AS account_name
      FROM users WHERE id = ${user.id}
    `,
    getEarnings(user.id),
  ]);

  const { me, above } = standing;
  const now = Date.now();
  const earlyOpen = new Date(settings.earlyDeadline).getTime() > now;
  const verified = user.verification_status === "verified";

  // Your rows on the boards, pinned below the list when you're not in it.
  const meNational: BoardRow = me
    ? toBoard(me, me.rank)
    : { id: user.id, nickname: user.nickname, photo_version: user.photo_version, state, refs: 0, rank: 0, verified: user.verification_status === "verified" && !user.is_flagged };
  const meState: BoardRow = { ...meNational, rank: me?.state_rank ?? 0 };

  let beat: string;
  if (!me) beat = "Invite your first friend to get on the leaderboard.";
  else if (me.rank === 1) beat = "You're leading. Keep inviting to stay on top.";
  else if (above) {
    const need = above.refs - me.refs + 1;
    beat = `${need} more ${need === 1 ? "friend" : "friends"} to pass ${above.nickname} (#${above.rank})${
      above.refs === me.refs ? ". You're tied, but they got there first." : ""
    }`;
  } else beat = "Keep inviting to climb.";

  const leader = stateBoard[0];
  const leading = leader
    ? `Currently leading in ${state}: ${leader.id === user.id ? "you" : leader.nickname} with ${friends(leader.refs)}`
    : `No one is leading in ${state} yet. Invite a friend to take the lead.`;

  const shareText = me
    ? `I'm #${me.state_rank} in ${state}, help me become Ambassador 👑 Join Kopamate with my link: ${referralLink(user.referral_code)}`
    : `Help me become ${state}'s Kopamate Ambassador 👑 Join with my link: ${referralLink(user.referral_code)}`;

  const prizes = [
    {
      key: "top10",
      title: "Top 10 nationwide",
      line: "The 10 corpers with the most friends joined when the leaderboard closes.",
      details: [
        `Ranked by friends who joined with your link and finished sign-up. The leaderboard closes ${lagosDay(settings.leaderboardClose)}.`,
        "Ties go to whoever reached the count first. Only verified corpers in good standing win.",
      ],
    },
    {
      key: "ambassadors",
      title: "State Ambassadors",
      line: "The top referrer in each state.",
      details: [
        "One Ambassador per state: the top referrer when camp ends joins the Kopamate team for their state.",
        "Ambassadors must be in good standing (no fake referrals). Final selection is confirmed by the Kopamate team.",
      ],
    },
    {
      key: "early",
      title: "Early Corpers",
      line: "Everyone holding the Early Corper badge.",
      details: [
        `Early Corpers joined before ${lagosDay(settings.earlyDeadline)} and qualify for the first rewards drop.`,
        "Only verified corpers in good standing qualify. Get verified in your Profile.",
      ],
    },
  ];

  const hasEarly = badges.some((b) => b.slug === "early_corper");
  const tagged = prizes.map((p) => (p.key === "early" && hasEarly ? { ...p, tag: "You have the badge" } : p));
  const profileComplete = badges.find((b) => b.slug === "profile_complete");
  const closedRow = (text: string) => <p className="flex-1 text-sm text-muted">{text}</p>;

  // Wallet totals. Hidden rewards have no amount yet; rejected ones don't count.
  const sum = (rs: MyReward[]) => rs.reduce((t, r) => t + (r.amount_ngn ?? 0), 0);
  const earned = sum(rewards.filter((r) => r.status !== "hidden" && r.status !== "rejected"));
  const toClaim = sum(rewards.filter((r) => r.status === "unclaimed"));
  const onTheWay = sum(rewards.filter((r) => r.status === "claimed" || r.status === "processing"));
  // Full cards only for rewards that need you (reveal, claim, bank details); the rest is History.
  const attention = rewards.filter((r) => r.status === "hidden" || r.status === "unclaimed" || r.status === "claimed");
  const history = rewards.filter((r) => r.status === "processing" || r.status === "paid" || r.status === "rejected");

  return (
    <>
      <RankConfetti national={me?.rank ?? null} state={me?.state_rank ?? null} />
      {profileComplete && (
        <BadgeCelebration slug="profile_complete" name="Profile Complete" awardedAt={new Date(profileComplete.awarded_at).toISOString()} />
      )}
      <h1 className="h-display text-[28px]">Rewards</h1>

      {/* Wallet: one number and what's waiting, like a payments app. */}
      <section className="card flex flex-col gap-3.5 !p-5" aria-label="Your earnings">
        <div>
          <p className="text-sm text-muted">Total earned</p>
          <p className="h-display mt-0.5 text-[40px] leading-none">{formatNgn(earned)}</p>
          <p className="mt-2 text-sm text-muted">
            <span className={toClaim > 0 ? "font-bold text-lime-ink" : ""}>{formatNgn(toClaim)} to claim</span> · {formatNgn(onTheWay)} on the
            way
          </p>
        </div>
        <ReferralEarnings
          compact
          className="flex items-center gap-3.5 border-t border-line pt-3.5"
          enabled={earnings.enabled}
          rate={earnings.rate}
          minWithdraw={earnings.minWithdraw}
          available={earnings.available}
          withdrawn={earnings.withdrawn}
          earnedCount={earnings.earnedCount}
          verified={user.verification_status === "verified"}
          underReview={user.is_flagged}
        />
      </section>

      {(attention.length > 0 || !verified) && (
        <section id="your-rewards" className="flex scroll-mt-4 flex-col gap-2.5" aria-labelledby="attention-title">
          <h2 id="attention-title" className="h-display text-xl">
            Needs your attention
          </h2>
          {attention.length > 0 && (
            <YourRewards
              rewards={attention}
              savedBank={saved[0] ?? { bank: null, account_number: null, account_name: null }}
              whatsapp={user.whatsapp_e164}
              underReview={user.is_flagged}
            />
          )}
          {!verified && (
            <Link href="/profile#verify" className="flex items-center gap-3.5 rounded-[20px] border-[1.5px] border-lime px-4 py-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime text-on-accent">
                <ShieldIcon size={20} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{user.verification_status === "pending" ? "Checking your ID" : "Get verified to win"}</span>
                <span className="block text-sm leading-snug text-muted">
                  {user.verification_status === "pending"
                    ? "You'll qualify for prizes once you're verified."
                    : user.verification_status === "rejected"
                      ? "Your verification needs another try."
                      : "Only verified corpers win prizes."}
                </span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-lime-ink" />
            </Link>
          )}
        </section>
      )}

      <Tabs labels={["History", "Leaderboard", "Prizes"]}>
        {history.length > 0 ? (
          <RewardHistory rewards={history} />
        ) : (
          <section className="flex flex-col items-center gap-2 rounded-[20px] border-[1.5px] border-dashed border-line px-5 py-6 text-center">
            <GiftIcon size={28} strokeWidth={1.8} className="text-faint" />
            <p className="font-bold">{rewards.length === 0 ? "Rewards you win show up here" : "Paid rewards show up here"}</p>
            <p className="text-sm leading-normal text-muted">
              Prizes are sent as airtime, data or bank transfer. You&apos;ll claim them here and we&apos;ll message you on WhatsApp.
            </p>
          </section>
        )}
        <>
          {/* Standing, with the countdowns underneath */}
          <section className="card flex flex-col gap-4 !p-[18px]" aria-labelledby="standing-title">
            <h2 id="standing-title" className="h-display text-lg">
              Your standing
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-line px-3.5 py-3">
                <div className="text-[13px] text-muted">Nigeria</div>
                <div className="h-display text-[30px] leading-tight text-lime-ink">{me ? `#${me.rank}` : "–"}</div>
              </div>
              <div className="rounded-2xl border border-line px-3.5 py-3">
                <div className="truncate text-[13px] text-muted">{state}</div>
                <div className="h-display text-[30px] leading-tight text-pink-ink">{me ? `#${me.state_rank}` : "–"}</div>
              </div>
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium leading-snug">{beat}</p>
                <p className="mt-0.5 text-sm text-muted">{me ? `${friends(me.refs)} joined with your link` : "No friends have joined yet"}</p>
              </div>
              <Link href="/invite" className="shrink-0 rounded-full bg-lime px-4 py-2 text-sm font-bold text-on-accent">
                Invite
              </Link>
            </div>
            <div className="flex flex-col border-t border-line pt-1">
              <div className="flex min-h-11 items-center gap-3">
                <ClockIcon size={18} className={`shrink-0 ${earlyOpen ? "text-lime-ink" : "text-faint"}`} />
                {earlyOpen ? (
                  <Deadline to={settings.earlyDeadline} after={closedRow("Early Corper closed · first rewards are being prepared.")}>
                    <p className="flex-1 text-sm">Early Corper badge closes in</p>
                    <Countdown to={settings.earlyDeadline} className="h-display text-[15px] text-lime-ink" />
                  </Deadline>
                ) : (
                  closedRow("Early Corper closed · first rewards are being prepared.")
                )}
              </div>
              <div className="flex min-h-11 items-center gap-3">
                <TrophyIcon size={18} className="shrink-0 text-pink-ink" />
                <Deadline to={settings.leaderboardClose} after={closedRow("Leaderboard closed · winners are being confirmed.")}>
                  <p className="flex-1 text-sm">Leaderboard closes in</p>
                  <Countdown to={settings.leaderboardClose} className="h-display text-[15px] text-pink-ink" />
                </Deadline>
              </div>
            </div>
          </section>
          <Leaderboard
            national={national.map((r) => toBoard(r, r.rank))}
            state={stateBoard.map((r) => toBoard(r, r.state_rank))}
            stateName={state}
            meNational={meNational}
            meState={meState}
            userId={user.id}
          />
        </>
        <Prizes
          prizes={tagged}
          revealText={settings.revealText}
          leading={leading}
          share={{ link: referralLink(user.referral_code), whatsappUrl: whatsappShareUrl(user.referral_code, shareText), message: shareText }}
        />
      </Tabs>
    </>
  );
}
