import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "./db";
import { DEFAULT_GUIDE, type Guide } from "@/content/pcm-guide";
import { guideProblems, sanitizePlan, type Plan } from "./pcm-rules";

/**
 * The NYSC checklist guide: the copy admins saved in settings (pcm_guide), or the default in content/pcm-guide.ts
 * when there's none or it fails validation. Page views go through the cached loader, never the settings rows.
 */

export const GUIDE_KEYS = {
  guide: "pcm_guide",
  previous: "pcm_guide_previous",
  version: "pcm_guide_version",
  enabled: "pcm_guide_enabled",
  whatsapp: "support_whatsapp",
  email: "support_email",
} as const;

export type GuideState = {
  guide: Guide;
  /** False when the saved copy was invalid and the default is shown instead. */
  savedValid: boolean;
  isDefault: boolean;
  version: number;
  enabled: boolean;
  supportWhatsapp: string | null;
  supportEmail: string | null;
};

async function loadGuide(): Promise<GuideState> {
  const rows = await sql<{ key: string; value: string }[]>`SELECT key, value FROM settings WHERE key IN ${sql(Object.values(GUIDE_KEYS))}`;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  let guide = DEFAULT_GUIDE;
  let savedValid = true;
  const raw = map.get(GUIDE_KEYS.guide);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (guideProblems(parsed).length === 0) guide = parsed;
      else savedValid = false;
    } catch {
      savedValid = false;
    }
  }
  return {
    guide,
    savedValid,
    isDefault: guide === DEFAULT_GUIDE,
    version: Number(map.get(GUIDE_KEYS.version)) || 0,
    enabled: map.get(GUIDE_KEYS.enabled) !== "0",
    supportWhatsapp: map.get(GUIDE_KEYS.whatsapp) || null,
    supportEmail: map.get(GUIDE_KEYS.email) || null,
  };
}

/** Cached; admin saves call revalidateTag("pcm-guide"). */
export const getGuideState = unstable_cache(loadGuide, ["pcm-guide"], { revalidate: 300, tags: ["pcm-guide"] });

/** Fresh read for the admin editor (never cached), so the version check is always current. */
export const getGuideStateFresh = loadGuide;

/** The user's saved checklist; empty if there's none (or the column isn't there yet, before the migration). */
export async function getUserPlan(userId: string): Promise<Plan> {
  try {
    const [row] = await sql<{ pcm_plan: unknown }[]>`SELECT pcm_plan FROM users WHERE id = ${userId}`;
    return sanitizePlan(row?.pcm_plan);
  } catch {
    return sanitizePlan(null);
  }
}
