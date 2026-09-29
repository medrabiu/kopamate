"use client";

import { useEffect, useState } from "react";

/** Animates a number up from `from` to `to`. Shows the final value straight away with reduced motion. */
export default function CountUp({ to, from = 0, prefix = "", duration = 900 }: { to: number; from?: number; prefix?: string; duration?: number }) {
  const [value, setValue] = useState(to);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || from === to) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    setValue(from);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, from, duration]);

  return (
    <>
      {prefix}
      {new Intl.NumberFormat("en-NG").format(value)}
    </>
  );
}
