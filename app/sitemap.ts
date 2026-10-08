import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";
import { getGuideState } from "@/lib/pcm-guide";

// Rebuilt hourly so new or renamed checklist steps show up.
export const revalidate = 3600;

/** Only the public pages; invite links (/r/…) and profiles point search engines elsewhere. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const { guide, enabled } = await getGuideState().catch(() => ({ guide: null, enabled: false }));
  const sections = enabled && guide ? [...guide.steps, ...guide.situations].filter((x) => x.show) : [];
  const reviewed = guide ? new Date(`${guide.lastReviewed}T12:00:00Z`) : now;
  return [
    { url: `${APP_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${APP_URL}/nysc-checklist`, lastModified: reviewed, changeFrequency: "weekly", priority: 0.9 },
    ...sections.map((x) => ({ url: `${APP_URL}/nysc-checklist/${x.slug}`, lastModified: reviewed, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${APP_URL}/join`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
