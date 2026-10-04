"use client";

import { Children, useId, useState } from "react";

/**
 * Segmented tabs over server-rendered panels (one child per tab, in order). Switching is instant: every
 * panel is already on the page, only the chosen one is shown.
 */
export default function Tabs({ labels, children }: { labels: string[]; children: React.ReactNode }) {
  const panels = Children.toArray(children);
  const [active, setActive] = useState(0);
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="grid gap-1 rounded-full bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${id}-panel-${i}`}
            onClick={() => setActive(i)}
            className={`flex h-10 items-center justify-center truncate rounded-full px-2 text-sm font-bold ${
              i === active ? "bg-bg text-ink" : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {panels.map((panel, i) => (
        <div key={i} role="tabpanel" id={`${id}-panel-${i}`} aria-labelledby={`${id}-tab-${i}`} hidden={i !== active} className="flex flex-col gap-5">
          {panel}
        </div>
      ))}
    </div>
  );
}
