import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen-safe max-w-[480px] flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="h-display text-4xl">Page not found</h1>
      <p className="text-muted">This link doesn&apos;t go anywhere.</p>
      <Link href="/" className="btn-primary max-w-[240px]">
        Go home
      </Link>
    </main>
  );
}
