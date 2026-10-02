import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";

/** Only the public pages; invite links (/r/…) point search engines back to / instead. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${APP_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${APP_URL}/join`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
