import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";

/** Public pages are open to search engines; the signed-in app, admin and APIs are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/auth/", "/card/", "/home", "/corpers", "/invite", "/rewards", "/profile"],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
