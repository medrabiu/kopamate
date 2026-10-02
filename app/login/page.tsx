import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { googleEnabled } from "@/lib/config";
import { ChevronLeft } from "@/components/icons";
import { Divider, GoogleButton } from "@/components/forms";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Log in", robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  google: "Google sign-in didn't work. Try again.",
  suspended: "This account has been suspended.",
  limit: "Too many sign-ups from this network. Try again in an hour.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(user.completed_at ? "/home" : "/join");
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-5 pb-8 pt-5">
      <div className="flex h-11 items-center">
        <Link href="/" aria-label="Back" className="flex size-11 items-center">
          <ChevronLeft size={24} />
        </Link>
      </div>
      <h1 className="h-display text-[34px] leading-tight">Welcome back</h1>
      {googleEnabled() && (
        <>
          <GoogleButton />
          <Divider text="or log in with your number" />
        </>
      )}
      <LoginForm initialError={error ? ERRORS[error] : undefined} />
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/join" className="font-bold text-lime-ink">
          Join now
        </Link>
      </p>
      <p className="mt-auto text-center text-xs text-faint">
        Forgot your PIN? Message us on WhatsApp from your registered number and we&apos;ll send you a new one.
      </p>
    </main>
  );
}
