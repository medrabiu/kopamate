import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import AdminNav from "./AdminNav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };
export const dynamic = "force-dynamic";

/** Every admin page checks access here, and each page runs only the few queries it needs. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <h1 className="h-display text-3xl">Admin</h1>
        <Link href="/home" className="text-sm font-bold text-lime-ink">
          Back to app
        </Link>
      </header>
      <AdminNav />
      {children}
    </main>
  );
}
