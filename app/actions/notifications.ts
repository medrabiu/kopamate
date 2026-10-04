"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/** Opening Notifications marks everything up to now as read, so the bell's count clears. */
export async function markNotificationsSeen() {
  const user = await getCurrentUser();
  if (!user) return;
  await sql`UPDATE users SET notifications_seen_at = now() WHERE id = ${user.id}`;
  revalidatePath("/home");
}
