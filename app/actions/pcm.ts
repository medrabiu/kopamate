"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getUserPlan } from "@/lib/pcm-guide";
import { mergePlans, sanitizePlan, type Plan } from "@/lib/pcm-rules";

export type PlanResult = { ok: true; plan: Plan } | { ok: false; error: string };

// A few saves per second is plenty (the page debounces to about one a second). Per server instance.
const recent = new Map<string, number[]>();
function limited(userId: string) {
  const now = Date.now();
  const hits = (recent.get(userId) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  recent.set(userId, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > 40;
}

async function store(userId: string, plan: Plan) {
  await sql`UPDATE users SET pcm_plan = ${sql.json(plan as never)} WHERE id = ${userId}`;
  // Home shows the readiness card.
  revalidatePath("/home");
}

/** Saves the signed-in user's checklist (answers and ticks), cleaned on the server. */
export async function savePlan(raw: unknown): Promise<PlanResult> {
  const user = await getCurrentUser();
  if (!user?.completed_at) return { ok: false, error: "Log in to save your progress." };
  if (limited(user.id)) return { ok: false, error: "Saving too fast. Try again in a moment." };
  const plan = sanitizePlan(raw);
  await store(user.id, plan);
  return { ok: true, plan };
}

/** After sign-up or login: progress kept on this device is merged into the account, once. */
export async function mergeDevicePlan(raw: unknown): Promise<PlanResult> {
  const user = await getCurrentUser();
  if (!user?.completed_at) return { ok: false, error: "Log in to save your progress." };
  const merged = mergePlans(await getUserPlan(user.id), sanitizePlan(raw));
  await store(user.id, merged);
  return { ok: true, plan: merged };
}
