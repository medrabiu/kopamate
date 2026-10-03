import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getAnnouncementSettings, getFirstNMode, getRewardSettings } from "@/lib/stats";
import { saveAnnouncement, saveRewardSettings, saveSettings } from "@/app/actions/admin";
import { saveMoneySettings } from "@/app/actions/admin-rewards";
import { getMoneySettings } from "@/lib/rewards";
import { getBonusSettings } from "@/lib/referral-bonus";
import { btnPrimary, input, panel } from "../ui";

export const metadata: Metadata = { title: "Settings" };

const ERRORS: Record<string, string> = {
  date: "Times must be ISO 8601 with a time zone, like 2026-10-02T23:59:59+01:00. Nothing was saved.",
  order: "The leaderboard must close after the Early Corper deadline. Nothing was saved.",
  budget: "The budget must be a whole number of naira. Nothing was saved.",
  cap: "The per-user cap must be a whole number of naira, or empty for no cap. Nothing was saved.",
  preset: "Presets are amounts separated by commas, like 30000, 20000, 15000. Nothing was saved.",
  bonus: "The referral bonus and minimum withdrawal must be whole naira (0 switches the bonus off). Nothing was saved.",
};

const lagosTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  await requireAdmin();
  const { error, saved } = await searchParams;
  const [mode, announcement, rewards, money, bonus] = await Promise.all([
    getFirstNMode(),
    getAnnouncementSettings(),
    getRewardSettings(),
    getMoneySettings(),
    getBonusSettings(),
  ]);

  return (
    <>
      <section className={panel}>
        <h2 className="h-display mb-1 text-lg">Countdowns and rewards</h2>
        <p className="mb-3 text-xs text-muted">
          ISO times with a time zone (Lagos is +01:00).
        </p>
        {error && ERRORS[error] && (
          <p role="alert" className="mb-3 rounded-lg border border-pink px-3 py-2 text-sm">
            {ERRORS[error]}
          </p>
        )}
        {saved && (
          <p role="status" className="mb-3 rounded-lg border border-lime px-3 py-2 text-sm">
            Saved.
          </p>
        )}
        <form action={saveRewardSettings} className="flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-muted">
              Early Corper deadline · now {lagosTime(rewards.earlyDeadline)}
              <input name="early_deadline" defaultValue={rewards.earlyDeadline} required className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Leaderboard closes · now {lagosTime(rewards.leaderboardClose)}
              <input name="leaderboard_close" defaultValue={rewards.leaderboardClose} required className={input} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Prize reveal text (on the mystery prize cards)
            <input name="rewards_reveal_text" defaultValue={rewards.revealText} maxLength={200} className={input} />
          </label>
          <button type="submit" className={`${btnPrimary} self-start`}>
            Save
          </button>
        </form>
      </section>

      <section className={panel}>
        <h2 className="h-display mb-1 text-lg">Reward money</h2>
        <p className="mb-3 text-xs text-muted">Whole naira. The budget and cap only warn; they never block an award.</p>
        <form action={saveMoneySettings} className="flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-muted">
              Total rewards budget (₦)
              <input name="rewards_budget_ngn" defaultValue={money.budget} inputMode="numeric" required className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Most one user can be awarded in total (₦, empty = no cap)
              <input name="max_claim_per_user_ngn" defaultValue={money.cap ?? ""} inputMode="numeric" className={input} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="referral_bonus_enabled" value="1" defaultChecked={bonus.enabled} className="size-4 accent-lime" />
            Referral bonus on (off: no new bonuses; people can still withdraw what they already earned)
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-muted">
              Referral bonus per verified friend (₦)
              <input name="referral_bonus_ngn" defaultValue={bonus.rate} inputMode="numeric" required className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Least a user can withdraw (₦)
              <input name="referral_bonus_min_withdraw_ngn" defaultValue={bonus.minWithdraw} inputMode="numeric" required className={input} />
            </label>
          </div>
          <p className="-mt-1 text-xs text-muted">
            A new bonus amount applies to friends verified from now on; bonuses already earned keep their amount.
          </p>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Top referrers preset, nationwide (one amount per rank, comma-separated)
            <input name="preset_top_referrers" defaultValue={(money.presets.top_referrers ?? []).join(", ")} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Top referrers preset, per state (empty = use the nationwide one)
            <input name="preset_top_state_referrers" defaultValue={(money.presets.top_state_referrers ?? []).join(", ")} className={input} />
          </label>
          <button type="submit" className={`${btnPrimary} self-start`}>
            Save
          </button>
        </form>
      </section>

      <section className={panel}>
        <h2 className="h-display mb-3 text-lg">Prizes</h2>
        <form action={saveSettings} className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            First 500 is counted by
            <select name="first_n_mode" defaultValue={mode} className={input}>
              <option value="position">position on the list</option>
              <option value="signup">sign-up order</option>
            </select>
          </label>
          <button type="submit" className={`${btnPrimary} self-start`}>
            Save
          </button>
        </form>
      </section>

      <section className={panel}>
        <h2 className="h-display mb-1 text-lg">Announcement</h2>
        <p className="mb-3 text-xs text-muted">A pink card on Home, under your position. Hidden when switched off or the title is empty.</p>
        <form action={saveAnnouncement} className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="announcement_active" value="1" defaultChecked={announcement.active} className="size-4 accent-lime" />
            Show on Home
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Title
            <input name="announcement_title" defaultValue={announcement.title} maxLength={60} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Text
            <textarea
              name="announcement_body"
              defaultValue={announcement.body}
              rows={2}
              maxLength={200}
              className="rounded-lg border border-line bg-bg p-3 text-sm text-ink"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
            <label className="flex flex-col gap-1 text-sm text-muted">
              Button label (optional)
              <input name="announcement_button_label" defaultValue={announcement.buttonLabel} maxLength={24} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Button link: starts with / or https://
              <input
                name="announcement_button_url"
                defaultValue={announcement.buttonUrl}
                maxLength={300}
                placeholder="/invite"
                pattern="(/[^/].*|/|https://.+)"
                className={input}
              />
            </label>
          </div>
          <button type="submit" className={`${btnPrimary} self-start`}>
            Save
          </button>
        </form>
      </section>
    </>
  );
}
