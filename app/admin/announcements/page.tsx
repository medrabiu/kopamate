import type { Metadata } from "next";
import Link from "next/link";
import { deleteAnnouncement, saveAnnouncement, setAnnouncementPinned, setAnnouncementVisible } from "@/app/actions/admin-content";
import { KIND_META, KINDS, TEMPLATES, type AnnouncementKind } from "@/lib/announcement-meta";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { btn, btnPrimary, input, panel } from "../ui";

export const metadata: Metadata = { title: "Announcements" };

const MESSAGES: Record<string, [string, boolean]> = {
  posted: ["Posted. It's in the Home carousel and in everyone's Notifications.", true],
  draft: ["Saved as a hidden draft. Nobody sees it until you press Show.", true],
  saved: ["Changes saved.", true],
  need_title: ["An announcement needs a title. Nothing was saved.", false],
};

type Row = {
  id: string;
  kind: AnnouncementKind;
  title: string;
  body: string | null;
  button_label: string | null;
  button_url: string | null;
  pinned: boolean;
  visible: boolean;
  published_at: Date | null;
  created_at: Date;
};

const lagosTime = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(d);

function Toggle({ action, id, name, on, label }: { action: (fd: FormData) => Promise<void>; id: string; name: string; on: boolean; label: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name={name} value={on ? "1" : "0"} />
      <button className={btn}>{label}</button>
    </form>
  );
}

type Props = { searchParams: Promise<{ msg?: string; t?: string; edit?: string }> };

export default async function AdminAnnouncementsPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const msg = MESSAGES[sp.msg ?? ""];
  const rows = await sql<Row[]>`
    SELECT id::text, kind, title, body, button_label, button_url, pinned, visible, published_at, created_at
    FROM announcements ORDER BY COALESCE(published_at, created_at) DESC, id DESC LIMIT 100
  `;
  const editing = sp.edit ? rows.find((r) => r.id === sp.edit) : undefined;
  const template = TEMPLATES.find((t) => t.key === sp.t) ?? TEMPLATES[0];
  // What the form starts with: the post being edited, or the chosen template.
  const f = editing
    ? {
        kind: editing.kind,
        title: editing.title,
        body: editing.body ?? "",
        buttonLabel: editing.button_label ?? "",
        buttonUrl: editing.button_url ?? "",
        pinned: editing.pinned,
      }
    : { ...template, pinned: false };

  return (
    <>
      {msg && (
        <p role={msg[1] ? "status" : "alert"} className={`rounded-2xl border p-4 text-sm ${msg[1] ? "border-lime" : "border-pink"}`}>
          {msg[0]}
        </p>
      )}

      <section className={panel} id="form">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="h-display text-lg">{editing ? "Edit announcement" : "New announcement"}</h2>
          {editing && (
            <Link href="/admin/announcements" className={btn}>
              Cancel
            </Link>
          )}
        </div>
        <p className="mb-3 text-xs text-muted">
          Visible ones show as slides in the Home carousel (the last 30 days, up to 6, pinned first) and in everyone&apos;s Notifications,
          where they count as new on the bell. Hidden ones are drafts nobody sees.
        </p>

        {!editing && (
          <div className="mb-4 flex flex-col gap-2">
            <p className="text-sm font-bold">Start from a template</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {TEMPLATES.map((t) => {
                const meta = KIND_META[t.kind];
                const on = t.key === template.key;
                return (
                  <Link
                    key={t.key}
                    href={`/admin/announcements?t=${t.key}#form`}
                    scroll={false}
                    aria-current={on ? "true" : undefined}
                    className={`flex flex-col rounded-xl border px-3 py-2 ${on ? "border-lime bg-surface-2" : "border-line hover:bg-surface-2"}`}
                  >
                    <span className="text-sm font-bold">
                      {meta.emoji} {t.name}
                    </span>
                    <span className="text-xs text-muted">{t.hint}</span>
                  </Link>
                );
              })}
            </div>
            <p className="text-xs text-faint">Replace the words in [brackets]. Everything stays editable.</p>
          </div>
        )}

        {/* key: switching template or post resets the fields to its values. */}
        <form key={editing?.id ?? template.key} action={saveAnnouncement} className="flex flex-col gap-3">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <label className="flex flex-col gap-1 text-sm text-muted">
            Type (sets the label and colour on Home)
            <select name="kind" defaultValue={f.kind} className={input}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_META[k].emoji} {KIND_META[k].label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Title
            <input name="title" required maxLength={80} defaultValue={f.title} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Text (optional)
            <textarea name="body" rows={3} maxLength={400} defaultValue={f.body} className="rounded-lg border border-line bg-bg p-3 text-sm text-ink" />
          </label>
          <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
            <label className="flex flex-col gap-1 text-sm text-muted">
              Button label (optional)
              <input name="button_label" maxLength={24} defaultValue={f.buttonLabel} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Button link: starts with / or https://
              <input
                name="button_url"
                maxLength={300}
                defaultValue={f.buttonUrl}
                placeholder="/quiz"
                pattern="(/[^/].*|/|https://.+)"
                className={input}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="pinned" value="1" defaultChecked={f.pinned} className="size-4 accent-lime" />
            Pin: show first in the Home carousel (and keep it there after 30 days)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="push" value="1" className="size-4 accent-lime" />
            Also send as a push notification to everyone who turned them on (only when visible)
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" name="visible" value="1" className={btnPrimary}>
              {editing ? "Save and show" : "Post now"}
            </button>
            <button type="submit" name="visible" value="0" className="rounded-full border border-line px-4 py-1.5 text-sm font-bold">
              {editing ? "Save hidden" : "Save as hidden draft"}
            </button>
          </div>
        </form>
      </section>

      <section className={panel}>
        <h2 className="h-display mb-3 text-lg">All announcements ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet. Pick a template above to post your first one.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((a) => {
              const meta = KIND_META[a.kind] ?? KIND_META.general;
              return (
                <li key={a.id} className={`flex flex-wrap items-start justify-between gap-3 py-3 ${a.visible ? "" : "opacity-70"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-bold">
                        {meta.emoji} {meta.label}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 font-bold ${a.visible ? "bg-lime text-on-accent" : "bg-surface-2 text-muted"}`}>
                        {a.visible ? "Visible" : "Hidden"}
                      </span>
                      {a.pinned && <span className="rounded bg-pink px-1.5 py-0.5 font-bold text-on-accent">Pinned</span>}
                    </p>
                    <p className="mt-1 font-bold">{a.title}</p>
                    {a.body && <p className="text-sm text-muted">{a.body}</p>}
                    <p className="mt-1 text-xs text-faint">
                      {a.published_at ? `Published ${lagosTime(a.published_at)}` : `Draft from ${lagosTime(a.created_at)}`}
                      {a.button_url && ` · ${a.button_label} → ${a.button_url}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/announcements?edit=${a.id}#form`} className={btn}>
                      Edit
                    </Link>
                    <Toggle action={setAnnouncementVisible} id={a.id} name="visible" on={!a.visible} label={a.visible ? "Hide" : "Show"} />
                    <Toggle action={setAnnouncementPinned} id={a.id} name="pinned" on={!a.pinned} label={a.pinned ? "Unpin" : "Pin"} />
                    <form action={deleteAnnouncement}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className={`${btn} text-pink-ink`}>Delete</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
