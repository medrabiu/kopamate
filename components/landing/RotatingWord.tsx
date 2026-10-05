"use client";

import { useEffect, useState } from "react";

/** Cycles through `words` every few seconds. Screen readers get the whole list once, not the changes. */
export default function RotatingWord({ words, className = "" }: { words: string[]; className?: string }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % words.length), 2600);
    return () => clearInterval(t);
  }, [words.length]);

  return (
    <>
      <span className="sr-only">{words.join(", ")}</span>
      <span aria-hidden="true" key={i} className={`word-in ${className}`}>
        {words[i]}
      </span>
    </>
  );
}
