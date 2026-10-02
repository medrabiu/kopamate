import type { Metadata } from "next";
import { cookies } from "next/headers";
import BadgeCelebration from "@/components/BadgeCelebration";
import BadgeShelf from "@/components/BadgeShelf";
import { CheckIcon } from "@/components/icons";
import { ProfileChecklist } from "@/components/ProfileProgress";
import { isAdmin, requireUser } from "@/lib/session";
import { getRank } from "@/lib/ranking";
import { getAllBadges, getProfileSteps, getUserBadges } from "@/lib/badges";
import { THEME_COOKIE } from "@/lib/theme";
import { formatJoined, formatNumber } from "@/lib/util";
import { maskPhone } from "@/lib/validate";
import { AccountActions, ChangePinRow, EditableRow, LightModeToggle, PhotoPicker, ShowInListToggle, VerificationCard } from "./ProfileControls";

export const metadata: Metadata = { title: "Profile" };

/** A small uppercase label above a group of settings. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="-mb-3 px-1 text-xs font-bold uppercase tracking-wider text-faint">{children}</h2>;
}

export default async function ProfilePage() {
  const user = await requireUser();
  const [rank, steps, all, mine, jar] = await Promise.all([
    getRank(user.id),
    getProfileSteps(user.id),
    getAllBadges(),
    getUserBadges(user.id),
    cookies(),
  ]);
  const earned = new Map(mine.map((b) => [b.slug, new Date(b.awarded_at).toISOString()]));
  const shelf = all.map((b) => ({ ...b, awarded_at: earned.get(b.slug) ?? null }));
  const complete = earned.get("profile_complete");
  const verified = user.verification_status === "verified";
  const refs = rank?.refs ?? 0;

  const stats: [string, string][] = [
    [rank ? `#${formatNumber(rank.position)}` : "–", "Position"],
    [formatNumber(refs), refs === 1 ? "Friend" : "Friends"],
    [`${mine.length}/${all.length}`, "Badges"],
  ];

  return (
    <>
      {complete && <BadgeCelebration slug="profile_complete" name="Profile Complete" awardedAt={complete} />}
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
        <dl className="grid grid-cols-3 divide-x divide-surface-2 rounded-2xl bg-surface-2/60 py-3">
          {stats.map(([value, label]) => (
            <div key={label} className="flex flex-col-reverse items-center gap-0.5">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="h-display text-xl leading-tight">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <VerificationCard status={user.verification_status} note={user.verification_note} stateCode={user.state_code} />

      <ProfileChecklist steps={steps} />

      <section className="flex flex-col gap-2.5" aria-labelledby="badges-title">
        <h2 id="badges-title" className="h-display text-lg">
          Badges
        </h2>
        <BadgeShelf badges={shelf} row />
      </section>

      <GroupLabel>Account</GroupLabel>
      <section className="divide-y divide-surface-2 rounded-[20px] bg-surface">
        <EditableRow field="nickname" label="Nickname" display={user.nickname} value={user.nickname} />
        <EditableRow field="whatsapp" label="WhatsApp" display={maskPhone(user.whatsapp_e164)} value={user.whatsapp_e164 ?? ""} />
        <EditableRow field="state" label="State" display={user.state ?? ""} value={user.state ?? ""} />
        {user.has_pin && <ChangePinRow />}
      </section>
      <p className="-mt-3 px-1 text-xs text-faint">
        Only you can see your WhatsApp number{user.state_code ? ` and state code (${user.state_code})` : ""}.
      </p>

      <GroupLabel>Preferences</GroupLabel>
      <section className="divide-y divide-surface-2 rounded-[20px] bg-surface">
        <ShowInListToggle on={user.show_in_list} />
        <LightModeToggle initial={jar.get(THEME_COOKIE)?.value === "light"} />
      </section>

      <AccountActions admin={isAdmin(user)} />
    </>
  );
}
