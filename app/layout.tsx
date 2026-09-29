import type { Metadata, Viewport } from "next";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/bricolage-grotesque/latin-600.css";
import "@fontsource/bricolage-grotesque/latin-800.css";
import "./globals.css";
import { APP_NAME, APP_URL } from "@/lib/config";
import ServiceWorker from "@/components/ServiceWorker";

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

export const viewport: Viewport = {
  themeColor: "#0E0E10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
