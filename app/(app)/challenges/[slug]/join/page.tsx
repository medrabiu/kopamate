import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import FollowButtons from "@/components/challenges/FollowButtons";
import { ChevronLeft } from "@/components/icons";
import { requireUser } from "@/lib/session";
import { getChallenge, getParticipant, lines } from "@/lib/challenges";
import JoinForm from "./JoinForm";

export const metadata: Metadata = { title: "Join the challenge" };

type Props = { params: Promise<{ slug: string }> };

export default async function JoinChallengePage({ params }: Props) {
  const user = await requireUser();
  const c = await getChallenge((await params).slug);
  if (!c) notFound();
  if (c.status !== "open" && c.status !== "upcoming") redirect(`/challenges/${c.slug}`);
  const participant = await getParticipant(c.id, user.id);
  const verified = user.verification_status === "verified";

  return (
    <>
      <Link href={`/challenges/${c.slug}`} className="-mb-2 flex items-center gap-1 self-start text-sm font-medium text-muted">
        <ChevronLeft size={16} /> {c.title}
      </Link>
      <div>
        <h1 className="h-display text-[28px]">{participant ? "Your details" : "Join the challenge"}</h1>
        <p className="mt-1 text-muted">{participant ? "You're in. Change your handles here if you need to." : "Four steps, then you can add your posts."}</p>
      </div>

      <section className="card flex flex-col gap-3">
        <h2 className="flex items-center gap-3 font-bold">
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${verified ? "bg-lime text-on-accent" : "border border-line text-muted"}`}
            aria-hidden="true"
          >
            {verified ? "✓" : 1}
          </span>
          Verified Kopamate account
        </h2>
        {verified ? (
          <p className="text-sm text-muted">Done. Your account is verified.</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              {user.verification_status === "pending"
                ? "We're checking your ID. Come back here once you're verified."
                : "Only verified corpers can enter. Add your state code and ID card in your Profile, then come back here."}
            </p>
            {user.verification_status !== "pending" && (
              <Link href="/profile#verify" className="btn-secondary h-12">
                Get verified
              </Link>
            )}
          </>
        )}
      </section>

      {verified ? (
        <JoinForm
          slug={c.slug}
          tags={c.required_tags}
          rules={lines(c.rules)}
          initial={participant}
          follow={<FollowButtons links={c.social_links} />}
        />
      ) : (
        <p className="text-center text-sm text-muted">The other steps unlock once you&apos;re verified.</p>
      )}
    </>
  );
}
