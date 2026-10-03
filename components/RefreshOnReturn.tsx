"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** How long the app must be in the background before coming back fetches fresh data. */
const AWAY_MS = 5 * 60 * 1000;

/**
 * An app added to the iPhone home screen has no pull-to-refresh, and phones keep it open in the background
 * for hours, so standings and new corpers would stay stale. Coming back after a while quietly refreshes the
 * page's data (what's typed or open on screen stays). Skipped on the quiz, whose clock runs on the server.
 */
export default function RefreshOnReturn() {
  const router = useRouter();
  const path = usePathname();
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const away = hiddenAt.current === null ? 0 : Date.now() - hiddenAt.current;
      hiddenAt.current = null;
      if (away >= AWAY_MS && navigator.onLine && !path.startsWith("/quiz")) router.refresh();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [router, path]);

  return null;
}
