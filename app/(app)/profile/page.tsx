import type { Metadata } from "next";
import Link from "next/link";
import BadgeCelebration from "@/components/BadgeCelebration";
import ProfileHeader from "@/components/ProfileHeader";
import VerifiedBadge from "@/components/VerifiedBadge";
import { ProfileChecklist } from "@/components/ProfileProgress";
import { ShareProfileButton } from "@/components/ShareProfile";
import { SettingsIcon } from "@/components/icons";
import { APP_URL } from "@/lib/config";
import { requireUser } from "@/lib/session";
import { getRank } from "@/lib/ranking";
import { getProfileSteps, getUserBadges } from "@/lib/badges";
import { getFollowCounts } from "@/lib/people";
import { isState, STATE_CODE_PREFIX } from "@/lib/states";
import { verificationBlock } from "@/lib/verification";
import { formatJoined, formatNumber } from "@/lib/util";
import { FollowStat, PhotoPicker, VerificationCard } from "./ProfileControls";

export const metadata: Metadata = { title: "Profile" };

const button = "flex h-10 items-center justify-center gap-1.5 rounded-full border border-line text-[15px] font-bold active:bg-surface-2";

/**
 * Your profile, X/Instagram style: who you are up top (cover, photo, name, stats), Edit profile and Share,
 * then anything left to finish. Account details and preferences live in Settings (/profile/settings).
 */
export default async function ProfilePage() {
  const user = await requireUser();
  const [rank, steps, mine, follows] = await Promise.all([
    getRank(user.id),
    getProfileSteps(user.id),
    getUserBadges(user.id),
    getFollowCounts(user.id),
  ]);
  // Badges aren't shown on Profile any more, but finishing your profile still gets its celebration.
  const complete = mine.find((b) => b.slug === "profile_complete");
  const verified = user.verification_status === "verified";
  const link = `${APP_URL}/u/${user.referral_code}`;

  return (
    <>
      {complete && (
        <BadgeCelebration slug="profile_complete" name="Profile Complete" awardedAt={new Date(complete.awarded_at).toISOString()} />
      )}
      <header className="-mb-2 flex h-11 items-center justify-between">
        <h1 className="h-display text-[28px]">Profile</h1>
        <Link href="/profile/settings" aria-label="Settings" className="-mr-2 flex size-11 items-center justify-center">
          <SettingsIcon size={22} />
        </Link>
      </header>

      <div id="photo" className="scroll-mt-5">
        <ProfileHeader
          id={user.id}
          avatar={<PhotoPicker id={user.id} nickname={user.nickname} photoVersion={user.photo_version} size={84} />}
          name={
            <>
              <span className="h-display truncate text-2xl leading-tight">{user.nickname}</span>
              {verified && !user.is_flagged && <VerifiedBadge size={22} />}
            </>
          }
          username={user.nickname}
          meta={`${user.state ? `Serving in ${user.state}` : "Corper"} · Joined ${formatJoined(user.completed_at!)}`}
          stats={
            <>
              <FollowStat userId={user.id} list="following" count={follows.following} />
              <FollowStat userId={user.id} list="followers" count={follows.followers} />
              {rank && (
                <span>
                  <span className="font-bold">#{formatNumber(rank.position)}</span> <span className="text-muted">Position</span>
                </span>
              )}
            </>
          }
          actions={
            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/profile/settings" className={button}>
                Edit profile
              </Link>
              <ShareProfileButton link={link} nickname={user.nickname} className={`${button} w-full`} />
            </div>
          }
        />
      </div>

      <VerificationCard
        status={user.verification_status}
        note={user.verification_note}
        stateCode={user.state_code}
        fullName={user.full_name}
        codePrefix={user.state && isState(user.state) ? STATE_CODE_PREFIX[user.state] : null}
        blocked={verificationBlock(user)}
      />

      <ProfileChecklist steps={steps} />
    </>
  );
}
