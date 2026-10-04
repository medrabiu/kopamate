"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { isKind } from "@/lib/announcement-meta";
import { isCategory } from "@/lib/opportunities";
import { sendPush } from "@/lib/push";
import { requireAdmin } from "@/lib/session";

const text = (fd: FormData, name: string, max: number) => String(fd.get(name) ?? "").trim().replace(/\s+/g, " ").slice(0, max);

function rowId(fd: FormData) {
  const v = String(fd.get("id") ?? "");
  if (!/^\d{1,18}$/.test(v)) throw new Error("Bad id");
  return v;
}

/** In-app ("/…") or https links only; anything else is dropped. */
function safeUrl(url: string, httpsOnly = false) {
  if (url.startsWith("https://")) return url;
  if (!httpsOnly && url.startsWith("/") && !url.startsWith("//")) return url;
  return "";
}

// ---------- Announcements ----------

function announcementsChanged() {
  revalidateTag("announcements");
  revalidatePath("/home");
  revalidatePath("/notifications");
  revalidatePath("/admin/announcements");
}

/** Sends an announcement to every phone with notifications on. Runs after the response: it can take a while. */
function pushToEveryone(title: string, body: string | null) {
  after(async () => {
    const users = await sql<{ user_id: string }[]>`SELECT DISTINCT user_id FROM push_subscriptions`;
    const ids = users.map((u) => u.user_id);
    for (let i = 0; i < ids.length; i += 200) {
      await sendPush(ids.slice(i, i + 200), {
        title: `📣 ${title}`,
        body: body ?? "New from the Kopamate team",
        url: "/notifications",
        tag: "announcement",
      });
    }
  });
}

/**
 * Creates (no id) or edits (id) an announcement. "Post now" makes it visible; "Save as hidden draft" keeps it
 * off the app. The first time it becomes visible counts as its publish time (new on everyone's bell).
 * "Push" sends it to phones too, only when it's visible.
 */
export async function saveAnnouncement(fd: FormData) {
  const admin = await requireAdmin();
  const editId = fd.get("id") ? rowId(fd) : null;
  const title = text(fd, "title", 80);
  if (!title) redirect(`/admin/announcements?msg=need_title${editId ? `&edit=${editId}` : ""}`);
  const kindValue = String(fd.get("kind") ?? "");
  const kind = isKind(kindValue) ? kindValue : "general";
  const body = String(fd.get("body") ?? "").trim().slice(0, 400) || null;
  const label = text(fd, "button_label", 24);
  const url = safeUrl(text(fd, "button_url", 300));
  const button = label && url ? { label, url } : { label: null, url: null };
  const pinned = fd.get("pinned") === "1";
  const visible = fd.get("visible") === "1";

  if (editId) {
    await sql`
      UPDATE announcements SET kind = ${kind}, title = ${title}, body = ${body}, button_label = ${button.label},
        button_url = ${button.url}, pinned = ${pinned}, visible = ${visible},
        published_at = CASE WHEN ${visible} THEN COALESCE(published_at, now()) ELSE published_at END, updated_at = now()
      WHERE id = ${editId}
    `;
  } else {
    await sql`
      INSERT INTO announcements (kind, title, body, button_label, button_url, pinned, visible, published_at, created_by)
      VALUES (${kind}, ${title}, ${body}, ${button.label}, ${button.url}, ${pinned}, ${visible},
              ${visible ? sql`now()` : null}, ${admin.id})
    `;
  }
  announcementsChanged();
  if (visible && fd.get("push") === "1") pushToEveryone(title, body);
  redirect(`/admin/announcements?msg=${editId ? "saved" : visible ? "posted" : "draft"}`);
}

/** Show or hide one. Showing a never-shown draft publishes it now. */
export async function setAnnouncementVisible(fd: FormData) {
  await requireAdmin();
  const visible = fd.get("visible") === "1";
  await sql`
    UPDATE announcements SET visible = ${visible},
      published_at = CASE WHEN ${visible} THEN COALESCE(published_at, now()) ELSE published_at END
    WHERE id = ${rowId(fd)}
  `;
  announcementsChanged();
}

export async function setAnnouncementPinned(fd: FormData) {
  await requireAdmin();
  await sql`UPDATE announcements SET pinned = ${fd.get("pinned") === "1"} WHERE id = ${rowId(fd)}`;
  announcementsChanged();
}

export async function deleteAnnouncement(fd: FormData) {
  await requireAdmin();
  await sql`DELETE FROM announcements WHERE id = ${rowId(fd)}`;
  announcementsChanged();
}

// ---------- Opportunities ----------

function opportunitiesChanged() {
  revalidatePath("/opportunities");
  revalidatePath("/home");
  revalidatePath("/admin/opportunities");
}

/** An opportunity the team found itself. Starts pinned (Featured) unless unticked. */
export async function addOpportunity(fd: FormData) {
  const admin = await requireAdmin();
  const title = text(fd, "title", 200);
  const url = safeUrl(text(fd, "url", 500), true);
  const category = String(fd.get("category") ?? "");
  if (!title || !url || !isCategory(category)) redirect("/admin/opportunities?msg=invalid");
  await sql`
    INSERT INTO opportunities (url, title, summary, source, category, deadline, pinned, added_by)
    VALUES (${url}, ${title}, ${String(fd.get("summary") ?? "").trim().slice(0, 300) || null},
            ${text(fd, "source", 60) || "Kopamate"}, ${category}, ${text(fd, "deadline", 40) || null},
            ${fd.get("pinned") === "1"}, ${admin.id})
    ON CONFLICT (url) DO UPDATE SET hidden = false, pinned = EXCLUDED.pinned
  `;
  opportunitiesChanged();
  redirect("/admin/opportunities?msg=added");
}

/** Hide/unhide or pin/unpin one opportunity. */
export async function setOpportunityFlag(fd: FormData) {
  await requireAdmin();
  const on = fd.get("on") === "1";
  const id = rowId(fd);
  if (fd.get("flag") === "hidden") await sql`UPDATE opportunities SET hidden = ${on} WHERE id = ${id}`;
  else await sql`UPDATE opportunities SET pinned = ${on} WHERE id = ${id}`;
  opportunitiesChanged();
}
