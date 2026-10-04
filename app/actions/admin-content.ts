"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { fetchOpportunities, isCategory } from "@/lib/opportunities";
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

/** Posts an announcement. "Pin" makes it the Home banner; "Push" also sends it to everyone with notifications on. */
export async function createAnnouncement(fd: FormData) {
  const admin = await requireAdmin();
  const title = text(fd, "title", 80);
  if (!title) redirect("/admin/announcements?msg=need_title");
  const body = String(fd.get("body") ?? "").trim().slice(0, 400) || null;
  const label = text(fd, "button_label", 24) || null;
  const url = safeUrl(text(fd, "button_url", 300)) || null;
  const pinned = fd.get("pinned") === "1";
  await sql`
    INSERT INTO announcements (title, body, button_label, button_url, pinned, created_by)
    VALUES (${title}, ${body}, ${label && url ? label : null}, ${label && url ? url : null}, ${pinned}, ${admin.id})
  `;
  announcementsChanged();
  if (fd.get("push") === "1") {
    // After the response: sending to everyone can take a while.
    after(async () => {
      const users = await sql<{ user_id: string }[]>`SELECT DISTINCT user_id FROM push_subscriptions`;
      const ids = users.map((u) => u.user_id);
      for (let i = 0; i < ids.length; i += 200) {
        await sendPush(ids.slice(i, i + 200), {
          title: `📣 ${title}`,
          body: body ?? "New from the Kopamate team",
          url: "/notifications?tab=updates",
          tag: "announcement",
        });
      }
    });
  }
  redirect("/admin/announcements?msg=posted");
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

/** Runs the daily fetch now, and shows how many new ones came in. */
export async function refreshOpportunities() {
  await requireAdmin();
  const { added, feeds } = await fetchOpportunities();
  opportunitiesChanged();
  const failed = feeds.filter((f) => "error" in f).map((f) => f.feed);
  redirect(`/admin/opportunities?added=${added}${failed.length ? `&failed=${encodeURIComponent(failed.join(", "))}` : ""}`);
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
