import Link from "next/link";
import { CheckIcon, ChevronRight } from "./icons";
import { PROFILE_STEPS } from "@/lib/badge-meta";
import type { ProfileSteps } from "@/lib/badges";

export function completion(steps: ProfileSteps) {
  const done = PROFILE_STEPS.filter((s) => steps[s.key]).length;
  return { done, percent: Math.round((done / PROFILE_STEPS.length) * 100), next: PROFILE_STEPS.find((s) => !steps[s.key]) ?? null };
}

function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-2 rounded-full bg-surface-2" role="progressbar" aria-label="Profile completion" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-2 rounded-full bg-lime" style={{ width: `${Math.max(4, percent)}%` }} />
    </div>
  );
}

/** Profile: every step with a tick. Hidden at 100% (the Profile Complete badge shows it instead). */
export function ProfileChecklist({ steps }: { steps: ProfileSteps }) {
  const { percent } = completion(steps);
  if (percent === 100) return null;
  return (
    <section className="card flex flex-col gap-3" aria-labelledby="checklist-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="checklist-title" className="h-display text-lg">
          Complete your profile
        </h2>
        <span className="h-display text-lime-ink">{percent}%</span>
      </div>
      <Bar percent={percent} />
      <ul className="flex flex-col">
        {PROFILE_STEPS.map((s) => {
          const done = steps[s.key];
          // Steps on this page are plain hash links, so the photo and verify sections react to them.
          const Tag = s.href.startsWith("/profile#") ? "a" : Link;
          return (
            <li key={s.key} className="border-b border-line last:border-b-0">
              <Tag href={s.href.startsWith("/profile#") ? s.href.slice("/profile".length) : s.href} className="flex min-h-12 items-center gap-3 py-2">
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full ${done ? "bg-lime text-on-accent" : "border-[1.5px] border-line"}`}
                >
                  {done && <CheckIcon size={16} strokeWidth={2.8} />}
                  <span className="sr-only">{done ? "Done:" : "To do:"}</span>
                </span>
                <span className={`flex-1 text-[15px] ${done ? "text-muted line-through decoration-1" : "font-medium"}`}>{s.label}</span>
                {!done && <ChevronRight size={18} className="shrink-0 text-faint" />}
              </Tag>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
