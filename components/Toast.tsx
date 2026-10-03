"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Tiny toast: const [toast, show] = useToast(); show("Link copied"); render {toast}. */
export function useToast(): [React.ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2200);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const node = (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4 transition-opacity ${
        msg ? "opacity-100" : "opacity-0"
      }`}
    >
      {msg && <div className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-bg">{msg}</div>}
    </div>
  );
  return [node, show];
}
