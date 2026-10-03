import type { Metadata } from "next";
import { cookies } from "next/headers";
import BadgeCelebration from "@/components/BadgeCelebration";
import { CheckIcon } from "@/components/icons";
import { ProfileChecklist } from "@/components/ProfileProgress";
import { isAdmin, requireUser } from "@/lib/session";
import { getRank } from "@/lib/ranking";
import { getProfileSteps, getUserBadges } from "@/lib/badges";
import { getFollowCounts } from "@/lib/people";
import { THEME_COOKIE } from "@/lib/theme";
import { formatJoined, formatNumber } from "@/lib/util";
import { maskPhone } from "@/lib/validate";
import {
  AccountActions,
  ChangePinRow,
  EditableRow,
  FollowStat,
  LightModeToggle,
  PhotoPicker,
  ShowInListToggle,
  VerificationCard,
} from "./ProfileControls";

export const metadata: Metadata = { title: "Profile" };

/** A small uppercase label above a group of settings. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="-mb-3 px-1 text-xs font-bold uppercase tracking-wider text-faint">{children}</h2>;
}

export default async function ProfilePage() {
  const user = await requireUser();
  const [rank, steps, mine, follows, jar] = await Promise.all([
    getRank(user.id),
    getProfileSteps(user.id),
    getUserBadges(user.id),
    getFollowCounts(user.id),
    cookies(),
  ]);
  // Badges aren't shown on Profile any more, but finishing your profile still gets its celebration.
  const complete = mine.find((b) => b.slug === "profile_complete");
  const verified = user.verification_status === "verified";

  return (
    <>
      {complete && (
        <BadgeCelebration slug="profile_complete" name="Profile Complete" awardedAt={new Date(complete.awarded_at).toISOString()} />
      )}
      <h1 className="h-display text-[28px]">Profile</h1>

      <section id="photo" className="card flex scroll-mt-5 flex-col gap-4 !p-[18px]" aria-label="Your profile">
        <div className="flex items-center gap-4">
          <PhotoPicker id={user.id} nickname={user.nickname} photoVersion={user.photo_version} />
          <div className="min-w-0 flex-1">
            <div className="h-display truncate text-2xl leading-tight">{user.nickname}</div>
            <div className="truncate text-sm text-muted">
              {user.state} · Joined {formatJoined(user.completed_at!)}
            </div>
            {verified && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-lime px-2 py-0.5 text-xs font-bold text-on-accent">
                <CheckIcon size={12} strokeWidth={3} />
                Verified corper
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line py-3">
          <div className="flex flex-col items-center gap-0.5">
            <span className="h-display text-xl leading-tight">{rank ? `#${formatNumber(rank.position)}` : "–"}</span>
            <span className="text-xs text-muted">Position</span>
          </div>
          <FollowStat userId={user.id} list="followers" count={follows.followers} />
          <FollowStat userId={user.id} list="following" count={follows.following} />
        </div>
      </section>

      <VerificationCard status={user.verification_status} note={user.verification_note} stateCode={user.state_code} />

      <ProfileChecklist steps={steps} />

      <GroupLabel>Account</GroupLabel>
      <section className="divide-y divide-line rounded-[20px] border border-line">
        <EditableRow field="nickname" label="Nickname" display={user.nickname} value={user.nickname} />
        <EditableRow field="whatsapp" label="WhatsApp" display={maskPhone(user.whatsapp_e164)} value={user.whatsapp_e164 ?? ""} />
        <EditableRow field="state" label="State" display={user.state ?? ""} value={user.state ?? ""} />
        {user.has_pin && <ChangePinRow />}
      </section>
      <p className="-mt-3 px-1 text-xs text-faint">
        Only you can see your WhatsApp number{user.state_code ? ` and state code (${user.state_code})` : ""}.
      </p>

      <GroupLabel>Preferences</GroupLabel>
      <section className="divide-y divide-line rounded-[20px] border border-line">
        <ShowInListToggle on={user.show_in_list} />
        <LightModeToggle initial={jar.get(THEME_COOKIE)?.value === "light"} />
      </section>

      <AccountActions admin={isAdmin(user)} />
    </>
  );
}
