import type { Metadata } from "next";
import { createAnnouncement, deleteAnnouncement, setAnnouncementPinned } from "@/app/actions/admin-content";
import { sql } from "@/lib/db";
import type { Announcement } from "@/lib/notifications";
import { requireAdmin } from "@/lib/session";
import { btn, btnPrimary, input, panel } from "../ui";

export const metadata: Metadata = { title: "Announcements" };

const MESSAGES: Record<string, [string, boolean]> = {
  posted: ["Posted. It's in the Home carousel and in everyone's Notifications.", true],
  need_title: ["An announcement needs a title. Nothing was posted.", false],
};

const lagosTime = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(d);

export default async function AdminAnnouncementsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const msg = MESSAGES[(await searchParams).msg ?? ""];
  const rows = await sql<Announcement[]>`
    SELECT id::text, title, body, button_label, button_url, pinned, created_at FROM announcements ORDER BY created_at DESC LIMIT 100
  `;

  return (
    <>
      {msg && (
        <p role={msg[1] ? "status" : "alert"} className={`rounded-2xl border p-4 text-sm ${msg[1] ? "border-lime" : "border-pink"}`}>
          {msg[0]}
        </p>
      )}

      <section className={panel}>
        <h2 className="h-display mb-1 text-lg">New announcement</h2>
        <p className="mb-3 text-xs text-muted">
          Shows as a slide in the Home carousel (the last 30 days, up to 6) and in everyone&apos;s Notifications, where it counts as new on
          their bell. Pinned ones come first in the carousel and stay there after 30 days.
        </p>
        <form action={createAnnouncement} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Title
            <input name="title" required maxLength={80} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Text (optional)
            <textarea name="body" rows={3} maxLength={400} className="rounded-lg border border-line bg-bg p-3 text-sm text-ink" />
          </label>
          <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
            <label className="flex flex-col gap-1 text-sm text-muted">
              Button label (optional)
              <input name="button_label" maxLength={24} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Button link: starts with / or https://
              <input name="button_url" maxLength={300} placeholder="/quiz" pattern="(/[^/].*|/|https://.+)" className={input} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="pinned" value="1" className="size-4 accent-lime" />
            Pin: show first in the Home carousel
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="push" value="1" className="size-4 accent-lime" />
            Also send as a push notification to everyone who turned them on
          </label>
          <button type="submit" className={`${btnPrimary} self-start`}>
            Post
          </button>
        </form>
      </section>

      <section className={panel}>
        <h2 className="h-display mb-3 text-lg">Posted ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">Nothing posted yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {a.pinned && <span className="mr-1.5 rounded bg-pink px-1.5 py-0.5 text-[11px] text-on-accent">Pinned</span>}
                    {a.title}
                  </p>
                  {a.body && <p className="text-sm text-muted">{a.body}</p>}
                  <p className="mt-1 text-xs text-faint">
                    {lagosTime(a.created_at)}
                    {a.button_url && ` · ${a.button_label} → ${a.button_url}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={setAnnouncementPinned}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="pinned" value={a.pinned ? "0" : "1"} />
                    <button className={btn}>{a.pinned ? "Unpin" : "Pin"}</button>
                  </form>
                  <form action={deleteAnnouncement}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className={`${btn} text-pink-ink`}>Delete</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
