import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getAnnouncementSettings, getFirstNMode, getPrizeText } from "@/lib/stats";
import { saveAnnouncement, saveSettings } from "@/app/actions/admin";
import { btnPrimary, input, panel } from "../ui";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [prizeText, mode, announcement] = await Promise.all([getPrizeText(), getFirstNMode(), getAnnouncementSettings()]);

  return (
    <>
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
