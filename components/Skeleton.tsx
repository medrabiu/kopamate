/**
 * Placeholder shapes shown while a tab loads, so switching tabs responds instantly.
 * Server components only, no JS. The pulse animation is switched off for reduced motion (globals.css).
 */
export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-2xl bg-surface-2 ${className}`} />;
}

/** Screen-reader text so the loading state is announced once. */
export function LoadingLabel({ label }: { label: string }) {
  return (
    <p role="status" className="sr-only">
      Loading {label}…
    </p>
  );
}

export function TitleSkeleton() {
  return <Bone className="h-8 w-40 rounded-xl" />;
}

export function CardSkeleton({ className = "h-24" }: { className?: string }) {
  return <Bone className={`w-full rounded-3xl ${className}`} />;
}

export function RowListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <Bone key={i} className="h-14 w-full rounded-[18px]" />
      ))}
    </div>
  );
}
