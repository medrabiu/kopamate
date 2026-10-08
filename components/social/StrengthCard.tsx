"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { dismissStrength } from "@/app/actions/social";

/** Home: "Your profile is 40% done — add your school…", linking to About you. Dismissible for 7 days. */
export default function StrengthCard({ score, hint }: { score: number; hint: string }) {
  const [hidden, setHidden] = useState(false);
  const [, start] = useTransition();
  if (hidden) return null;
  return (
    <section className="flex items-center gap-3 rounded-[20px] border border-line px-4 py-3.5" aria-label="Profile strength">
      <Link href="/profile/settings#about" className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold">Your profile is {score}% done</span>
        <span className="block text-sm text-muted">{hint.charAt(0).toUpperCase() + hint.slice(1)} ›</span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <span className="block h-full rounded-full bg-lime" style={{ width: `${Math.max(4, score)}%` }} />
        </span>
      </Link>
      <button
        type="button"
        aria-label="Hide for a week"
        onClick={() => {
          setHidden(true);
          start(async () => {
            await dismissStrength();
          });
        }}
        className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted"
      >
        ✕
      </button>
    </section>
  );
}
