"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";

/** Time on each slide before it moves on by itself. */
const AUTO_MS = 6000;

/**
 * Swipeable row of slides with dots (the announcements on Home). Slides snap into place; the next one peeks in
 * so it's clear there's more. It moves on by itself every few seconds until the person touches it, and never
 * for people who prefer reduced motion. Slides are rendered on the server and passed in as children.
 */
export default function Carousel({ label, children }: { label: string; children: React.ReactNode }) {
  const slides = Children.toArray(children);
  const count = slides.length;
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const touched = useRef(false);

  const goTo = useCallback((i: number) => {
    const el = ref.current;
    const first = el?.children[0] as HTMLElement | undefined;
    const target = el?.children[i] as HTMLElement | undefined;
    if (!el || !first || !target) return;
    el.scrollTo({ left: target.offsetLeft - first.offsetLeft, behavior: "smooth" });
  }, []);

  const onScroll = () => {
    const el = ref.current;
    if (!el || el.children.length < 2) return;
    const step = (el.children[1] as HTMLElement).offsetLeft - (el.children[0] as HTMLElement).offsetLeft;
    setIndex(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / step))));
  };

  useEffect(() => {
    if (count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!touched.current && document.visibilityState === "visible") goTo((index + 1) % count);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [index, count, goTo]);

  if (count === 0) return null;
  const stop = () => (touched.current = true);

  return (
    <div className="flex flex-col gap-2.5" role="region" aria-roledescription="carousel" aria-label={label}>
      <div
        ref={ref}
        onScroll={onScroll}
        onPointerDown={stop}
        onTouchStart={stop}
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5"
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            className={`shrink-0 snap-start ${count > 1 ? "w-[calc(100%-28px)]" : "w-full"}`}
          >
            {slide}
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="flex justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show update ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => {
                stop();
                goTo(i);
              }}
              className="flex h-6 items-center"
            >
              <span className={`block h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-pink" : "w-1.5 bg-line"}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
