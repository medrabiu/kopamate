"use client";

import { useEffect } from "react";

/** Counts a landing page view from the browser (the page itself is cached, so the server doesn't see each visit). */
export default function LandingBeacon() {
  useEffect(() => {
    try {
      void fetch("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "landing_view" }),
        keepalive: true,
      });
    } catch {}
  }, []);
  return null;
}
