import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { APP_NAME, APP_URL } from "@/lib/config";
import ConnectionBanner from "@/components/ConnectionBanner";
import ServiceWorker from "@/components/ServiceWorker";
import { THEME_COLOR, THEME_COOKIE, themeMigrationScript, type Theme } from "@/lib/theme";

async function currentTheme(): Promise<Theme> {
  return (await cookies()).get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
}

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: `${APP_NAME}: every corper, one place`, template: `%s · ${APP_NAME}` },
  description: "Join corpers across Nigeria. Climb the list, invite friends and be first in line for contests, awards and prizes.",
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME}: every corper, one place`,
    description: "Join corpers across Nigeria. Prizes for the first 500 people.",
  },
};

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
      </body>
    </html>
  );
}
