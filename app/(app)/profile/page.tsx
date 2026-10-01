import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import BadgeCelebration from "@/components/BadgeCelebration";
import BadgeShelf from "@/components/BadgeShelf";
import { ProfileChecklist } from "@/components/ProfileProgress";
import { isAdmin, requireUser } from "@/lib/session";
import { getRank } from "@/lib/ranking";
import { getAllBadges, getProfileSteps, getUserBadges } from "@/lib/badges";
import { THEME_COOKIE } from "@/lib/theme";
import { formatJoined, formatNumber } from "@/lib/util";
import { maskPhone } from "@/lib/validate";
import { AccountActions, ChangePinRow, EditableRow, LightModeToggle, PhotoPicker, ShowInListToggle, VerificationCard } from "./ProfileControls";

export const metadata: Metadata = { title: "Profile" };

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

  return (
    <>
      {complete && <BadgeCelebration slug="profile_complete" name="Profile Complete" awardedAt={complete} />}
      <h1 className="h-display text-[28px]">Profile</h1>

      <section id="photo" className="flex scroll-mt-5 flex-col items-center gap-2.5">
        <PhotoPicker id={user.id} nickname={user.nickname} photoVersion={user.photo_version} />
        <div className="h-display text-2xl">{user.nickname}</div>
        <div className="text-sm text-muted">
          {user.state} · #{formatNumber(rank?.position ?? 0)} · Joined {formatJoined(user.completed_at!)}
        </div>
      </section>

      <section className="flex flex-col gap-2.5" aria-labelledby="badges-title">
        <h2 id="badges-title" className="h-display text-xl">
          Badges <span className="text-base text-muted">· {mine.length} of {all.length}</span>
        </h2>
        <BadgeShelf badges={shelf} />
      </section>

      <ProfileChecklist steps={steps} />

      <VerificationCard status={user.verification_status} note={user.verification_note} stateCode={user.state_code} />

      <section>
        <EditableRow field="nickname" label="Nickname" display={user.nickname} value={user.nickname} />
        <EditableRow
          field="whatsapp"
          label="WhatsApp · only you can see this"
          display={maskPhone(user.whatsapp_e164)}
          value={user.whatsapp_e164 ?? ""}
        />
        <EditableRow field="state" label="State serving in" display={user.state ?? ""} value={user.state ?? ""} />
        {user.verification_status !== "verified" && user.verification_status !== "pending" && (
          <div id="state-code" className="scroll-mt-5">
            <EditableRow
              field="state_code"
              label="State code · only you can see this"
              display={user.state_code || "Not added"}
              value={user.state_code ?? ""}
              muted={!user.state_code}
              actionLabel={user.state_code ? "Edit" : "Add"}
            />
          </div>
        )}
        {user.has_pin && <ChangePinRow />}
        <ShowInListToggle on={user.show_in_list} />
        <LightModeToggle initial={jar.get(THEME_COOKIE)?.value === "light"} />
      </section>

      {isAdmin(user) && (
        <Link href="/admin" className="btn-secondary">
          Open admin
        </Link>
      )}

      <AccountActions />
    </>
  );
}
