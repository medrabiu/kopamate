import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { ChevronLeft } from "@/components/icons";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-5 pb-12 pt-5 text-[15px] leading-relaxed">
      <Link href="/" aria-label="Back" className="flex size-11 items-center">
        <ChevronLeft size={24} />
      </Link>
      <h1 className="h-display text-3xl">Privacy notice</h1>
      <p className="text-muted">
        {APP_NAME} is an independent app for corps members. It is not run by or affiliated with the NYSC.
      </p>

      <h2 className="h-display text-xl">What we collect</h2>
      <ul className="list-disc space-y-1 pl-5 text-muted">
        <li>Your nickname, the state you&apos;re serving in, and a photo if you add one.</li>
        <li>Your WhatsApp number, and your email if you sign in with Google.</li>
        <li>Your state code, only if you choose to add it.</li>
        <li>Who invited you and who you invited.</li>
        <li>A scrambled (hashed) version of your network address, to stop fake sign-ups.</li>
      </ul>

      <h2 className="h-display text-xl">What other users see</h2>
      <p className="text-muted">
        Only your nickname, photo, state and position. Your WhatsApp number, email and state code are never shown to
        anyone else. You can hide yourself from the Corpers list in your profile.
      </p>

      <h2 className="h-display text-xl">Why we collect it</h2>
      <p className="text-muted">
        To run your account, count referrals fairly, stop fake accounts, and contact you on WhatsApp if you win a
        prize. We don&apos;t sell your data.
      </p>

      <h2 className="h-display text-xl">Your choices</h2>
      <p className="text-muted">
        You can edit your details or delete your account at any time from your profile. Deleting your account removes
        your data from the app.
      </p>
    </main>
  );
}
