"use client";

import { useEffect, useState } from "react";

/**
 * A slim notice when the phone loses its connection, so a page that won't load isn't a mystery.
 * Uses the browser's online/offline events; nothing is downloaded.
 */
export default function ConnectionBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(8px,env(safe-area-inset-top))]">
      <p className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-bg">You&apos;re offline. Check your data, then try again.</p>
    </div>
  );
}
