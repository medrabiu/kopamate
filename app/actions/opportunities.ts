"use server";

import { revalidatePath } from "next/cache";
import { refreshIfStale } from "@/lib/opportunities";
import { getCurrentUser } from "@/lib/session";

/** "Check for new" on an empty Opportunities list. At most one real fetch every 10 minutes, whoever taps. */
export async function checkForOpportunities() {
  if (!(await getCurrentUser())) return;
  await refreshIfStale(10 * 60 * 1000);
  revalidatePath("/opportunities");
  revalidatePath("/home");
}
