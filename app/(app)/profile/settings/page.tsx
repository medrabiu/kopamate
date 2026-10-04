import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ChevronLeft } from "@/components/icons";
import { isAdmin, requireUser } from "@/lib/session";
import { vapidPublicKey } from "@/lib/push";
import { THEME_COOKIE } from "@/lib/theme";
import { maskPhone } from "@/lib/validate";
import { NyscStatusRow } from "@/components/NyscStatusForm";
import { AccountActions, ChangePinRow, EditableRow, LightModeToggle, NotificationsToggle, ShowInListToggle } from "../ProfileControls";

export const metadata: Metadata = { title: "Settings" };

/** A small uppercase label above a group of settings. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="-mb-3 px-1 text-xs font-bold uppercase tracking-wider text-faint">{children}</h2>;
}

/** Account details and preferences, behind "Edit profile" and the gear on Profile (as on X and Instagram). */
export default async function SettingsPage() {
  const user = await requireUser();
  const jar = await cookies();

  return (
    <>
      <header className="flex h-11 items-center">
        <Link href="/profile" className="-ml-2 flex items-center gap-1 py-2 pr-2 text-[15px] font-bold" aria-label="Back to Profile">
          <ChevronLeft size={20} />
          Settings
        </Link>
      </header>

      <GroupLabel>Account</GroupLabel>
      <section className="divide-y divide-line rounded-[20px] border border-line">
        <EditableRow field="nickname" label="Username" display={`@${user.nickname}`} value={user.nickname} />
        <EditableRow
          field="full_name"
          label="Full name"
          display={user.full_name || "Not added"}
          value={user.full_name ?? ""}
          muted={!user.full_name}
          actionLabel={user.full_name ? "Edit" : "Add"}
        />
        <EditableRow field="whatsapp" label="WhatsApp" display={maskPhone(user.whatsapp_e164)} value={user.whatsapp_e164 ?? ""} />
        <NyscStatusRow
          stage={user.nysc_stage}
          batch={user.nysc_batch}
          state={user.state}
          canPickState={user.nysc_stage === "waiting" || !user.state}
        />
        {/* State is set when you join and can't be changed here (an admin can fix it), except while awaiting call-up. */}
        {user.nysc_stage !== "waiting" && (
          <div className="flex min-h-14 items-center gap-3 px-4 py-3">
            <span className="shrink-0 text-[15px] text-muted">State</span>
            <span className="min-w-0 flex-1 truncate text-right text-[15px] font-medium">{user.state ?? "–"}</span>
          </div>
        )}
        {user.has_pin && <ChangePinRow />}
      </section>
      <p className="-mt-3 px-1 text-xs text-faint">
        Only you can see your full name and WhatsApp number{user.state_code ? `, and your state code (${user.state_code})` : ""}.{" "}
        {user.nysc_stage === "waiting"
          ? "When your call-up comes, update NYSC above and pick the state you're posted to."
          : "Your state can't be changed after you join; message us on WhatsApp if it's wrong."}
      </p>

      <GroupLabel>Preferences</GroupLabel>
      <section className="divide-y divide-line rounded-[20px] border border-line">
        <ShowInListToggle on={user.show_in_list} />
        {vapidPublicKey && <NotificationsToggle publicKey={vapidPublicKey} />}
        <LightModeToggle initial={jar.get(THEME_COOKIE)?.value === "light"} />
      </section>

      <AccountActions admin={isAdmin(user)} />
    </>
  );
}
