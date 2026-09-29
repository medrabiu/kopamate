"use client";

import { Children, useEffect, useRef, useState } from "react";

/**
 * Swipeable row of full-width slides (CSS scroll-snap) with dots underneath.
 * Slides are rendered on the server and passed in as children; no auto-advance.
 */
export default function HomeCarousel({ labels, children }: { labels: string[]; children: React.ReactNode }) {
  const slides = Children.toArray(children);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const root = track.current;
    if (!root || slides.length < 2) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { root, threshold: 0.6 },
    );
    for (const el of Array.from(root.children)) observer.observe(el);
    return () => observer.disconnect();
  }, [slides.length]);

  function goTo(i: number) {
    const slide = track.current?.children[i] as HTMLElement | undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    slide?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <section aria-roledescription="carousel" aria-label="Highlights" className="flex flex-col gap-2.5">
      <div
        ref={track}
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 overscroll-x-contain"
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            data-index={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${labels[i] ?? `Slide ${i + 1}`} (${i + 1} of ${slides.length})`}
            className="flex w-full shrink-0 snap-center snap-always"
          >
            {slide}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="flex justify-center">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show ${labels[i] ?? `slide ${i + 1}`}`}
              aria-current={i === active}
              className="flex size-6 items-center justify-center"
            >
              <span className={`h-2 rounded-full transition-all ${i === active ? "w-5 bg-lime" : "w-2 bg-line"}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
