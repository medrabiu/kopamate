"use client";

import { useEffect } from "react";
import { markNotificationsSeen } from "@/app/actions/notifications";

/** Clears the bell once the page has actually been shown (not on a background prefetch). */
export default function MarkSeen() {
  useEffect(() => {
    markNotificationsSeen().catch(() => {});
  }, []);
  return null;
}
