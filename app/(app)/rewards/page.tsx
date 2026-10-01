import type { Metadata } from "next";
import Link from "next/link";
import BadgeCelebration from "@/components/BadgeCelebration";
import BadgeChip from "@/components/BadgeChip";
import Countdown, { Deadline } from "@/components/Countdown";
import ShareButtons from "@/components/ShareButtons";
import { ChevronRight, ClockIcon, GiftIcon, TrophyIcon } from "@/components/icons";
import { requireUser } from "@/lib/session";
import { getNationalLeaderboard, getReferrerStanding, getStateLeaderboard, type ReferrerRow } from "@/lib/ranking";
import { getRewardSettings } from "@/lib/stats";
import { getUserBadges } from "@/lib/badges";
import { getPredictionResults, getUserPrediction } from "@/lib/predictions";
import { referralLink, whatsappShareUrl } from "@/lib/config";
import { sql } from "@/lib/db";
import { formatJoined } from "@/lib/util";
import { AmbassadorCard, Leaderboard, MysteryPrizes, RankConfetti, StatePrediction, type BoardRow } from "./RewardsClient";

export const metadata: Metadata = { title: "Rewards" };

const lagosDay = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));

const friends = (n: number) => `${n} ${n === 1 ? "friend" : "friends"}`;

function toBoard(r: ReferrerRow, rank: number): BoardRow {
  return { id: r.id, nickname: r.nickname, photo_version: r.photo_version, state: r.state, refs: r.refs, rank, top_badge: r.top_badge };
}

export default async function RewardsPage() {
  const user = await requireUser();
  const state = user.state ?? "";
  const [settings, standing, national, stateBoard, badges, results, myPick, rewards] = await Promise.all([
    getRewardSettings(),
    getReferrerStanding(user.id),
    getNationalLeaderboard(),
    getStateLeaderboard(state),
    getUserBadges(user.id),
    getPredictionResults(),
    getUserPrediction(user.id),
    sql<{ id: string; title: string; description: string | null; status: string; created_at: Date }[]>`
      SELECT id, title, description, status, created_at FROM rewards WHERE user_id = ${user.id} ORDER BY created_at DESC
    `,
  ]);

  const { me, above } = standing;
  const now = Date.now();
  const earlyOpen = new Date(settings.earlyDeadline).getTime() > now;
  const verified = user.verification_status === "verified";

  // Your rows on the boards, pinned below the list when you're not in it.
  const meNational: BoardRow = me
    ? toBoard(me, me.rank)
    : { id: user.id, nickname: user.nickname, photo_version: user.photo_version, state, refs: 0, rank: 0, top_badge: badges[0] ?? null };
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

  const sortedBadges = [...badges].sort((a, b) => Number(b.qualifies_for_rewards) - Number(a.qualifies_for_rewards));
  const profileComplete = badges.find((b) => b.slug === "profile_complete");

  return (
    <>
      <RankConfetti national={me?.rank ?? null} state={me?.state_rank ?? null} />
      {profileComplete && (
        <BadgeCelebration slug="profile_complete" name="Profile Complete" awardedAt={new Date(profileComplete.awarded_at).toISOString()} />
      )}
      <h1 className="h-display text-[28px]">Rewards</h1>

      {/* 1. Countdowns */}
      <section className="card flex flex-col gap-0 !py-1.5" aria-label="Countdowns">
        {earlyOpen && (
          <div className="flex min-h-13 items-center gap-3 border-b border-surface-2 py-2">
            <ClockIcon size={20} className="shrink-0 text-lime-ink" />
            <Deadline to={settings.earlyDeadline} after={<p className="flex-1 text-sm font-medium">Early Corper closed · first rewards are being prepared.</p>}>
              <p className="flex-1 text-sm font-medium">Early Corper badge closes in</p>
              <Countdown to={settings.earlyDeadline} className="h-display text-lg text-lime-ink" />
            </Deadline>
          </div>
        )}
        {!earlyOpen && (
          <div className="flex min-h-13 items-center gap-3 border-b border-surface-2 py-2">
            <ClockIcon size={20} className="shrink-0 text-faint" />
            <p className="flex-1 text-sm font-medium">Early Corper closed · first rewards are being prepared.</p>
          </div>
        )}
        <div className="flex min-h-13 items-center gap-3 py-2">
          <TrophyIcon size={20} className="shrink-0 text-pink-ink" />
          <Deadline to={settings.leaderboardClose} after={<p className="flex-1 text-sm font-medium">Leaderboard closed · winners are being confirmed.</p>}>
            <p className="flex-1 text-sm font-medium">Leaderboard closes in</p>
            <Countdown to={settings.leaderboardClose} className="h-display text-lg text-pink-ink" />
          </Deadline>
        </div>
      </section>

      {/* 2. Your standing */}
      <section className="card flex flex-col gap-3" aria-labelledby="standing-title">
        <h2 id="standing-title" className="h-display text-xl">
          Your standing
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-surface-2 p-3.5">
            <div className="text-[13px] text-muted">Nigeria</div>
            <div className="h-display text-[32px] leading-tight text-lime-ink">{me ? `#${me.rank}` : "–"}</div>
          </div>
          <div className="rounded-2xl bg-surface-2 p-3.5">
            <div className="truncate text-[13px] text-muted">{state}</div>
            <div className="h-display text-[32px] leading-tight text-pink-ink">{me ? `#${me.state_rank}` : "–"}</div>
          </div>
        </div>
        <p className="text-[15px] font-medium">{beat}</p>
        <p className="text-sm text-muted">{me ? `${friends(me.refs)} joined with your link` : "No friends have joined with your link yet"}</p>
        <Link href="/invite" className="btn-primary h-12 text-[15px]">
          Invite friends
        </Link>
      </section>

      {!verified && (
        <Link href="/profile#verify" className="flex items-center gap-3.5 rounded-[18px] border-[1.5px] border-lime p-4">
          <div className="min-w-0 flex-1">
            <div className="font-bold">{user.verification_status === "pending" ? "Verification in progress" : "Get verified to win"}</div>
            <div className="text-sm text-muted">
              {user.verification_status === "pending"
                ? "We're checking your ID. You'll qualify once you're verified."
                : user.verification_status === "rejected"
                  ? "Your verification needs another try. Open Profile to see why."
                  : "Add your state code and NYSC ID card in Profile. Only verified corpers win prizes."}
            </div>
          </div>
          <ChevronRight size={20} className="shrink-0 text-lime-ink" />
        </Link>
      )}

      {/* 3. Leaderboard */}
      <Leaderboard
        national={national.map((r) => toBoard(r, r.rank))}
        state={stateBoard.map((r) => toBoard(r, r.state_rank))}
        stateName={state}
        meNational={meNational}
        meState={meState}
        userId={user.id}
      />

      {/* 4. Mystery prizes */}
      <MysteryPrizes prizes={prizes} revealText={settings.revealText} />

      {/* 5. State Ambassador programme */}
      <AmbassadorCard leading={leading} />

      {/* 6. State prediction */}
      <StatePrediction
        results={results}
        myPick={myPick}
        locked={!earlyOpen}
        lockLabel={
          earlyOpen
            ? `One vote each. You can change it until ${lagosDay(settings.earlyDeadline)}. Right picks earn the Prophet badge.`
            : "Votes are locked. Right picks earn the Prophet badge when camp ends."
        }
      />

      {/* 7. Your badges and rewards */}
      <section className="flex flex-col gap-2.5" aria-labelledby="your-badges">
        <h2 id="your-badges" className="h-display text-xl">
          Your badges
        </h2>
        {sortedBadges.length === 0 ? (
          <p className="text-sm text-muted">
            No badges yet. See how to earn them on your{" "}
            <Link href="/profile" className="font-bold text-lime-ink">
              Profile
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sortedBadges.map((b) => (
              <li key={b.slug} className="flex items-center gap-3 rounded-[18px] bg-surface px-3.5 py-3">
                <BadgeChip badge={b} />
                <span className="min-w-0 flex-1 truncate text-sm text-muted">{b.description}</span>
                {b.qualifies_for_rewards && (
                  <span className="shrink-0 rounded-full border border-pink px-2 py-0.5 text-[11px] font-bold text-pink-ink">
                    Qualifies for rewards
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
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

      {/* 8. Share */}
      <section className="card flex flex-col gap-3 !p-[18px]" aria-labelledby="share-title">
        <h2 id="share-title" className="h-display text-lg leading-tight">
          {me ? `You're #${me.state_rank} in ${state}` : `Lead ${state}`}
        </h2>
        <p className="text-sm text-muted">Ask friends to join with your link and help you become {state}&apos;s Ambassador.</p>
        <ShareButtons
          variant="compact"
          link={referralLink(user.referral_code)}
          whatsappUrl={whatsappShareUrl(user.referral_code, shareText)}
          message={shareText}
        />
      </section>
    </>
  );
}
