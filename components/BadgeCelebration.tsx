"use client";

import { useEffect, useState } from "react";
import Confetti from "./Confetti";
import { useToast } from "./Toast";

/**
 * Confetti the first time this device sees a newly earned badge (awarded in the last 7 days).
 * Remembered in localStorage so it fires once; if storage is blocked it simply doesn't fire again this visit.
 */
export default function BadgeCelebration({ slug, name, awardedAt }: { slug: string; name: string; awardedAt: string }) {
  const [fire, setFire] = useState(false);
  const [toast, show] = useToast();

  useEffect(() => {
    if (Date.now() - new Date(awardedAt).getTime() > 7 * 86400_000) return;
    const key = `km_celebrated_${slug}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // Storage blocked: celebrate anyway, it just may repeat on another visit.
    }
    setFire(true);
    show(`You earned the ${name} badge`);
  }, [slug, name, awardedAt, show]);

  return (
    <>
      <Confetti fire={fire} />
      {toast}
    </>
  );
}
