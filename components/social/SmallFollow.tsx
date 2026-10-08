"use client";

import { useState, useTransition } from "react";
import { follow } from "@/app/actions/social";

/** A compact Follow / Following button for lists. Changes at once; undone with a short message if it fails. */
export default function SmallFollow({ id, following }: { id: string; following: boolean }) {
  const [on, setOn] = useState(following);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <span className="flex shrink-0 flex-col items-end">
      <button
        type="button"
        aria-pressed={on}
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const next = !on;
          setOn(next);
          setError("");
          start(async () => {
            const r = await follow(id, next).catch(() => ({ ok: false as const, error: "Couldn't save" }));
            if (!r.ok) {
              setOn(!next);
              setError(r.error);
            }
          });
        }}
        className={`h-8 rounded-full px-3.5 text-[13px] font-bold ${on ? "border border-line text-muted" : "bg-ink text-bg"}`}
      >
        {on ? "Following" : "Follow"}
      </button>
      {error && (
        <span role="alert" className="mt-1 max-w-36 text-right text-[11px] leading-tight text-pink-ink">
          {error}
        </span>
      )}
    </span>
  );
}
