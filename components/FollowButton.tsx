"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFollow } from "@/app/actions/follows";

/** Follow / Following button for a profile page. The change shows straight away and is undone on error. */
export default function FollowButton({ id, following, followsYou }: { id: string; following: boolean; followsYou: boolean }) {
  const [on, setOn] = useState(following);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle() {
    const next = !on;
    setOn(next);
    setError(null);
    start(async () => {
      const res = await setFollow(id, next);
      if ("error" in res) {
        setOn(!next);
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
        className={`group h-12 rounded-full px-6 text-[15px] font-bold transition-colors ${
          on ? "border border-line text-ink hover:border-pink hover:text-pink-ink" : "bg-ink text-bg hover:opacity-90"
        }`}
      >
        {on ? (
          <>
            <span className="group-hover:hidden">Following</span>
            <span className="hidden group-hover:inline">Unfollow</span>
          </>
        ) : followsYou ? (
          "Follow back"
        ) : (
          "Follow"
        )}
      </button>
      {error && (
        <p role="alert" className="text-sm text-pink-ink">
          {error}
        </p>
      )}
    </div>
  );
}
