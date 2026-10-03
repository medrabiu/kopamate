import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/config";
import { THEME_COLOR } from "@/lib/theme";

/**
 * The install manifest. Phones fetch it without cookies, so the theme comes in the URL instead:
 * app/layout.tsx links ?theme=light for light-mode users, so Android's launch splash and status bar
 * match their theme instead of flashing black.
 */
export function GET(req: Request) {
  const color = THEME_COLOR[new URL(req.url).searchParams.get("theme") === "light" ? "light" : "dark"];
  const manifest: MetadataRoute.Manifest = {
    // Same as the id phones already derived from start_url, so existing installs stay the same app.
    id: "/home",
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Every corper, one place.",
    start_url: "/home",
    display: "standalone",
    background_color: color,
    theme_color: color,
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
