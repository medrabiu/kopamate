import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { referrerFromCookie } from "@/lib/signup";
import { googleEnabled } from "@/lib/config";
import { ChevronLeft } from "@/components/icons";
import { FinishForm, PhoneSignupForm } from "./JoinForm";

export const metadata: Metadata = {
  title: "Join free",
  description: "Join Kopamate in 20 seconds with your phone number or Google. Free for NYSC corps members in every state.",
  alternates: { canonical: "/join" },
};
export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const user = await getCurrentUser();
  if (user?.completed_at) redirect("/home");
  const referrer = await referrerFromCookie(user?.id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-5 pb-8 pt-5">
      <div className="flex h-11 items-center">
        <Link href="/" aria-label="Back" className="flex size-11 items-center">
          <ChevronLeft size={24} />
        </Link>
      </div>

      {user ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="h-display text-[34px] leading-tight">Almost done</h1>
            <p className="text-[15px] text-muted">Add your WhatsApp number and state to get your position.</p>
          </div>
          <FinishForm nickname={user.nickname} />
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="h-display text-[34px] leading-tight">Join in 20 seconds</h1>
            <p className="text-[15px] text-muted">
              {referrer ? `${referrer.nickname} invited you. You'll both move up when you join.` : "Get your position and start climbing."}
            </p>
          </div>
          <PhoneSignupForm googleOn={googleEnabled()} />
          <p className="text-center text-sm text-muted">
            Already joined?{" "}
            <Link href="/login" className="font-bold text-lime-ink">
              Log in
            </Link>
          </p>
        </>
      )}

      <p className="mt-auto text-center text-xs leading-relaxed text-faint">
        Your number is only used to contact you about prizes. It&apos;s never shown to other users.{" "}
        <Link href="/privacy" className="underline">
          Privacy notice
        </Link>
      </p>
    </main>
  );
}
