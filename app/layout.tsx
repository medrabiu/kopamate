import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { APP_NAME, APP_URL, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/config";
import ConnectionBanner from "@/components/ConnectionBanner";
import ServiceWorker from "@/components/ServiceWorker";
import { splashImages } from "@/lib/splash";
import { THEME_COLOR, themeBootScript, themeMigrationScript } from "@/lib/theme";

const APPLE_WEB_APP = { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" } as const;

const baseMetadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: SITE_TITLE, template: `%s · ${APP_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: [
    "NYSC",
    "NYSC app",
    "corps members",
    "corpers",
    "NYSC corpers",
    "NYSC orientation camp",
    "service year",
    "corpers in Nigeria",
    "NYSC state code",
    "CDS",
    "SAED",
  ],
  category: "social networking",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    locale: "en_NG",
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
};

/**
 * The same for everyone, so pages that don't need a signed-in user can be cached. Dark by default; the head
 * script switches the theme colour and install manifest to light for people who chose light mode.
 */
export const metadata: Metadata = {
  ...baseMetadata,
  manifest: "/manifest.webmanifest",
  appleWebApp: { ...APPLE_WEB_APP, startupImage: splashImages("dark") },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR.dark,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Light mode is a cookie (km_theme) applied by the first script in <head>, before anything paints. That
    // script (and the migration one) set data-theme, so React must not complain about it.
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeMigrationScript }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <ConnectionBanner />
        <ServiceWorker />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
