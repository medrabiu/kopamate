"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="h-display text-3xl">Something went wrong</h1>
      <p className="text-muted">It&apos;s probably the network. Try again.</p>
      <button
        type="button"
        // Fetch the page from the server again (reset alone only re-renders what's already loaded).
        onClick={() => startTransition(() => (router.refresh(), reset()))}
        className="btn-primary max-w-[240px]"
      >
        Try again
      </button>
    </main>
  );
}
