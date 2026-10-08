"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { track } from "@/lib/stats";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = ["close_report", "clear_bio", "hide", "ban", "unflag"] as const;

/**
 * Admin → People: one form action for the moderation buttons. Each is logged as an admin_action event
 * (admin id, action, target id).
 */
export async function peopleAction(fd: FormData) {
  const admin = await requireAdmin();
  const action = String(fd.get("action")) as (typeof ACTIONS)[number];
  const target = String(fd.get("target") ?? "");
  const reportId = Number(fd.get("report"));
  if (!ACTIONS.includes(action) || !UUID.test(target)) redirect("/admin/people?msg=invalid");
  if (action === "ban" && target === admin.id) redirect("/admin/people?msg=invalid");

  switch (action) {
    case "close_report":
      await sql`UPDATE reports SET status = 'closed', closed_at = now(), closed_by = ${admin.id} WHERE id = ${reportId} AND status = 'open'`;
      break;
    case "clear_bio":
      await sql`UPDATE users SET bio = NULL WHERE id = ${target}`;
      break;
    case "hide":
      await sql`UPDATE users SET show_in_list = false WHERE id = ${target}`;
      break;
    case "ban":
      await sql`UPDATE users SET is_banned = true WHERE id = ${target}`;
      await sql`DELETE FROM sessions WHERE user_id = ${target}`;
      break;
    case "unflag":
      await sql`UPDATE users SET is_flagged = false WHERE id = ${target}`;
      break;
  }
  await track("admin_action", null, { admin: admin.id, action, target, ...(reportId ? { report: reportId } : {}) });
  revalidatePath("/admin/people");
  redirect(`/admin/people?msg=${action}`);
}
