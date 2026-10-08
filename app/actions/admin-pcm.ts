"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { sql, transaction } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { track } from "@/lib/stats";
import { lagosDate } from "@/lib/util";
import { DEFAULT_GUIDE, type Guide } from "@/content/pcm-guide";
import { GUIDE_KEYS, getGuideStateFresh } from "@/lib/pcm-guide";
import { guideProblems } from "@/lib/pcm-rules";

export type GuideSaveResult = { ok: true; version: number; guide: Guide } | { ok: false; error: string; problems?: string[] };

const STALE = "Someone updated the guide. Reload to see their changes.";

function refresh() {
  revalidateTag("pcm-guide");
  // The checklist and every /nysc-checklist/<step> page.
  revalidatePath("/nysc-checklist", "layout");
  revalidatePath("/home");
  revalidatePath("/admin/pcm-guide");
}

/**
 * Replaces the saved guide in one transaction: checks nobody saved since `expectedVersion`, keeps the current copy
 * as pcm_guide_previous (for Undo; "" means the default), stores the new one (null: back to the default) and bumps
 * the version.
 */
async function replaceGuide(next: Guide | null, expectedVersion: number, adminId: string, action: string): Promise<GuideSaveResult> {
  const result = await transaction(async (tx) => {
    await tx`INSERT INTO settings (key, value) VALUES (${GUIDE_KEYS.version}, '0') ON CONFLICT (key) DO NOTHING`;
    const [v] = await tx<{ value: string }[]>`SELECT value FROM settings WHERE key = ${GUIDE_KEYS.version} FOR UPDATE`;
    const current = Number(v.value) || 0;
    if (current !== expectedVersion) return { ok: false as const, error: STALE };
    const [cur] = await tx<{ value: string }[]>`SELECT value FROM settings WHERE key = ${GUIDE_KEYS.guide}`;
    await tx`
      INSERT INTO settings (key, value) VALUES (${GUIDE_KEYS.previous}, ${cur?.value ?? ""})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    if (next) {
      await tx`
        INSERT INTO settings (key, value) VALUES (${GUIDE_KEYS.guide}, ${JSON.stringify(next)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    } else {
      await tx`DELETE FROM settings WHERE key = ${GUIDE_KEYS.guide}`;
    }
    await tx`UPDATE settings SET value = ${String(current + 1)} WHERE key = ${GUIDE_KEYS.version}`;
    return { ok: true as const, version: current + 1 };
  });
  if (!result.ok) return result;
  await track(action, null, { admin: adminId, version: result.version });
  refresh();
  return { ok: true, version: result.version, guide: next ?? DEFAULT_GUIDE };
}

/** Saves the edited guide after checking it. */
export async function saveGuide(guide: unknown, expectedVersion: number): Promise<GuideSaveResult> {
  const admin = await requireAdmin();
  const problems = guideProblems(guide);
  if (problems.length) return { ok: false, error: "Fix these first:", problems };
  return replaceGuide(guide as Guide, expectedVersion, admin.id, "pcm_guide_saved");
}

/** Puts back the version before the last save (saving again puts this one back). */
export async function undoGuide(expectedVersion: number): Promise<GuideSaveResult> {
  const admin = await requireAdmin();
  const [prev] = await sql<{ value: string }[]>`SELECT value FROM settings WHERE key = ${GUIDE_KEYS.previous}`;
  if (!prev) return { ok: false, error: "There's no earlier version to go back to." };
  let guide: Guide | null = null;
  if (prev.value) {
    try {
      guide = JSON.parse(prev.value);
    } catch {
      return { ok: false, error: "The earlier version can't be read." };
    }
    if (guideProblems(guide).length) return { ok: false, error: "The earlier version isn't valid any more." };
  }
  return replaceGuide(guide, expectedVersion, admin.id, "pcm_guide_undone");
}

/** Back to the built-in content (content/pcm-guide.ts). Undo brings the saved copy back. */
export async function resetGuide(expectedVersion: number): Promise<GuideSaveResult> {
  const admin = await requireAdmin();
  return replaceGuide(null, expectedVersion, admin.id, "pcm_guide_reset");
}

/** Sets "Last reviewed" to today (Lagos) on the saved guide. */
export async function markGuideReviewed(expectedVersion: number): Promise<GuideSaveResult> {
  const admin = await requireAdmin();
  const { guide } = await getGuideStateFresh();
  return replaceGuide({ ...guide, lastReviewed: lagosDate() }, expectedVersion, admin.id, "pcm_guide_reviewed");
}

export type GuideSettingsResult = { ok: true } | { ok: false; error: string };

/** The on/off switch and the "Report wrong info" contacts. */
export async function saveGuideSettings(_prev: GuideSettingsResult | undefined, fd: FormData): Promise<GuideSettingsResult> {
  const admin = await requireAdmin();
  const enabled = fd.get("enabled") === "on";
  const whatsappRaw = String(fd.get("support_whatsapp") ?? "").trim();
  const email = String(fd.get("support_email") ?? "").trim();
  const digits = whatsappRaw.replace(/[\s()-]/g, "");
  if (digits && !/^\+?[1-9]\d{7,14}$/.test(digits)) return { ok: false, error: "WhatsApp number: use international format, like +2348031234567." };
  if (email && !/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(email)) return { ok: false, error: "That email address doesn't look right." };
  const rows: [string, string][] = [
    [GUIDE_KEYS.enabled, enabled ? "1" : "0"],
    [GUIDE_KEYS.whatsapp, digits ? `+${digits.replace(/^\+/, "")}` : ""],
    [GUIDE_KEYS.email, email],
  ];
  for (const [key, value] of rows) {
    await sql`INSERT INTO settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
  await track("pcm_guide_settings", null, { admin: admin.id, enabled });
  refresh();
  return { ok: true };
}
