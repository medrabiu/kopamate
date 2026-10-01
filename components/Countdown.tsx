"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** "1d 09:42:17", or "09:42:17" in the last day. */
export function formatLeft(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const hms = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}

type Props = {
  /** ISO time to count down to. */
  to: string;
  /** Shown once the countdown reaches zero. Nothing is rendered when it's null. */
  after?: React.ReactNode;
  className?: string;
};

/**
 * Live days/hours/minutes/seconds to `to`. The seconds tick with a small fade that's switched off
 * for people who prefer reduced motion (the global rule in globals.css); the numbers still update.
 */
export default function Countdown({ to, after = null, className = "" }: Props) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);

  const left = target - now;
  if (!(left > 0)) return <>{after}</>;
  const text = formatLeft(left);
  return (
    <time dateTime={to} className={`tabular-nums ${className}`} suppressHydrationWarning>
      {text.slice(0, -2)}
      <span key={text} className="countdown-tick" suppressHydrationWarning>
        {text.slice(-2)}
      </span>
    </time>
  );
}

/** Shows `children` until `to`, then `after` (nothing by default). Swaps over live, without a reload. */
export function Deadline({ to, after = null, children }: { to: string; after?: React.ReactNode; children: React.ReactNode }) {
  const target = new Date(to).getTime();
  const [passed, setPassed] = useState(() => !(target > Date.now()));

  useEffect(() => {
    const left = target - Date.now();
    setPassed(!(left > 0));
    if (!(left > 0)) return;
    // setTimeout can't wait longer than ~24.8 days; nobody keeps a tab open that long.
    const t = setTimeout(() => setPassed(target <= Date.now()), Math.min(left + 50, 2_147_000_000));
    return () => clearTimeout(t);
  }, [target]);

  return <>{passed ? after : children}</>;
}
