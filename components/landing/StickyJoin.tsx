"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Phones: a Join bar slides up from the bottom once the hero's own Join button has scrolled away. */
export default function StickyJoin({ watch, total }: { watch: string; total: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = document.getElementById(watch);
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [watch]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-300 md:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
      inert={!show}
    >
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-sm leading-snug">
          <span className="font-bold">Join {total} corpers</span>
          <span className="block text-muted">Free, 20 seconds</span>
        </p>
        <Link href="/join" className="flex h-12 shrink-0 items-center rounded-full bg-lime px-7 font-bold text-on-accent">
          Join free
        </Link>
      </div>
    </div>
  );
}
