import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { ChevronLeft } from "@/components/icons";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "What Kopamate collects from NYSC corps members, why, who can see it, and how to delete your account.",
  alternates: { canonical: "/privacy" },
};

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
        <li>Your username, the state you&apos;re serving in, and a photo if you add one.</li>
        <li>Your WhatsApp number, and your email if you sign in with Google.</li>
        <li>Your full name and state code, only if you choose to add them.</li>
        <li>
          If you ask to be verified: a photo of your NYSC ID card, seen only by our team and deleted once we&apos;ve checked it. We
          keep a short fingerprint of the photo (not the photo) so the same card can&apos;t be used on more than one account.
        </li>
        <li>
          If you claim a prize: your bank name, account number and account name, or the phone number for airtime or
          data. We keep your last bank details to fill in your next claim.
        </li>
        <li>Who invited you and who you invited.</li>
        <li>A scrambled (hashed) version of your network address, to stop fake sign-ups.</li>
      </ul>

      <h2 className="h-display text-xl">What other users see</h2>
      <p className="text-muted">
        Only your nickname, photo, state and position. Your full name, WhatsApp number, email, state code and bank details are never
        shown to anyone else. You can hide yourself from the Corpers list in your profile.
      </p>

      <h2 className="h-display text-xl">Why we collect it</h2>
      <p className="text-muted">
        To run your account, count referrals fairly, stop fake accounts, and contact you on WhatsApp and pay you if you
        win a prize. We don&apos;t sell your data.
      </p>

      <h2 className="h-display text-xl">Your choices</h2>
      <p className="text-muted">
        You can edit your details or delete your account at any time from your profile. Deleting your account removes
        your data from the app.
      </p>
    </main>
  );
}
