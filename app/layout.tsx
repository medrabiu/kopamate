import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { APP_NAME, APP_URL, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/config";
import ConnectionBanner from "@/components/ConnectionBanner";
import ServiceWorker from "@/components/ServiceWorker";
import { splashImages } from "@/lib/splash";
import { THEME_COLOR, THEME_COOKIE, themeMigrationScript, type Theme } from "@/lib/theme";

async function currentTheme(): Promise<Theme> {
  return (await cookies()).get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
}

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

/** The install manifest and iPhone launch screens follow the theme, so opening the app doesn't flash the wrong colour. */
export async function generateMetadata(): Promise<Metadata> {
  const theme = await currentTheme();
  return {
    ...baseMetadata,
    manifest: theme === "light" ? "/manifest.webmanifest?theme=light" : "/manifest.webmanifest",
    appleWebApp: { ...APPLE_WEB_APP, startupImage: splashImages(theme) },
  };
}

export async function generateViewport(): Promise<Viewport> {
  return {
    themeColor: THEME_COLOR[await currentTheme()],
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await currentTheme();
  return (
    // Light mode is a cookie (km_theme), so the server sends the right theme. The migration script may still
    // set data-theme for people with the old saved setting, so React must not complain about it.
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <head>
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
