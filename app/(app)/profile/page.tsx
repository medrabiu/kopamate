import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin, requireUser } from "@/lib/session";
import { getRank } from "@/lib/ranking";
import { formatJoined, formatNumber } from "@/lib/util";
import { maskPhone } from "@/lib/validate";
import { AccountActions, ChangePinRow, EditableRow, LightModeToggle, PhotoPicker, ShowInListToggle, VerificationCard } from "./ProfileControls";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const rank = await getRank(user.id);

  return (
    <>
      <h1 className="h-display text-[28px]">Profile</h1>

      <section className="flex flex-col items-center gap-2.5">
        <PhotoPicker id={user.id} nickname={user.nickname} photoVersion={user.photo_version} />
        <div className="h-display text-2xl">{user.nickname}</div>
        <div className="text-sm text-muted">
          {user.state} · #{formatNumber(rank?.position ?? 0)} · Joined {formatJoined(user.completed_at!)}
        </div>
      </section>

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
          <EditableRow
            field="state_code"
            label="State code · only you can see this"
            display={user.state_code || "Not added"}
            value={user.state_code ?? ""}
            muted={!user.state_code}
            actionLabel={user.state_code ? "Edit" : "Add"}
          />
        )}
        {user.has_pin && <ChangePinRow />}
        <ShowInListToggle on={user.show_in_list} />
        <LightModeToggle />
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
