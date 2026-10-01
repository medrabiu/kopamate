import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getAnnouncementSettings, getFirstNMode, getPrizeText, getRewardSettings } from "@/lib/stats";
import { saveAnnouncement, saveRewardSettings, saveSettings } from "@/app/actions/admin";
import { btnPrimary, input, panel } from "../ui";

export const metadata: Metadata = { title: "Settings" };

const ERRORS: Record<string, string> = {
  date: "Times must be ISO 8601 with a time zone, like 2026-10-02T23:59:59+01:00. Nothing was saved.",
  order: "The leaderboard must close after the Early Corper deadline. Nothing was saved.",
};

const lagosTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  await requireAdmin();
  const { error, saved } = await searchParams;
  const [prizeText, mode, announcement, rewards] = await Promise.all([
    getPrizeText(),
    getFirstNMode(),
    getAnnouncementSettings(),
    getRewardSettings(),
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
        <h2 className="h-display mb-3 text-lg">Prizes</h2>
        <form action={saveSettings} className="flex flex-col gap-3">
          <label className="text-sm text-muted" htmlFor="prize">
            Prize text (shown on Landing, Home and Rewards)
          </label>
          <textarea
            id="prize"
            name="prize_teaser_text"
            defaultValue={prizeText}
            rows={2}
            maxLength={300}
            className="rounded-lg border border-line bg-bg p-3 text-sm"
          />
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
        <p className="mb-3 text-xs text-muted">A pink slide in the carousel at the top of Home. Hidden when switched off or the title is empty.</p>
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
