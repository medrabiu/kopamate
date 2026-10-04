import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import ProfileHeader from "@/components/ProfileHeader";
import ShareProfile from "@/components/ShareProfile";
import VerifiedBadge from "@/components/VerifiedBadge";
import { APP_NAME, APP_URL } from "@/lib/config";
import { getProfileByCode } from "@/lib/people";
import { getCurrentUser } from "@/lib/session";
import { track } from "@/lib/stats";
import { stageLine, type Stage } from "@/lib/nysc";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

const fmt = (n: number) => new Intl.NumberFormat("en-NG").format(n);
const joinedOn = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso));

/** " is serving in Lagos", for the link preview. */
function profileBlurb(stage: Stage, state: string | null) {
  if (stage === "waiting") return " is awaiting call-up";
  if (!state) return stage === "served" ? " is an ex-corper" : " is a corper";
  return stage === "served" ? ` served in ${state}` : stage === "posted" ? ` is posted to ${state}` : ` is serving in ${state}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProfileByCode((await params).code, null);
  if (!p) return { title: "Profile not found", robots: { index: false } };
  const title = `Follow ${p.nickname} on ${APP_NAME}`;
  const description = `${p.nickname}${profileBlurb(p.nysc_stage, p.state)} on ${APP_NAME}, the free app for NYSC corps members. Join to follow them.`;
  return {
    title: { absolute: title },
    description,
    // Profiles are for sharing, not for search results.
    robots: { index: false, follow: true },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * Someone's shareable profile (/u/<code>, using their invite code). Logged in: Follow them here.
 * Logged out: a public preview (only what's already public) and "Join Kopamate to follow". The middleware
 * remembers the code, so sign-up credits them as the inviter and follows them automatically.
 */
export default async function ProfileLinkPage({ params }: Props) {
  const { code } = await params;
  const viewer = await getCurrentUser();
  const viewerId = viewer?.completed_at ? viewer.id : null;
  const p = await getProfileByCode(code, viewerId);
  if (!p) notFound();
  const me = p.id === viewerId;
  after(() => track("profile_link_view", viewerId, { profile: p.id, logged_in: Boolean(viewerId) }));

  return (
    <div className="min-h-screen-safe">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-[480px] items-center justify-between px-5">
          <Link href={viewerId ? "/home" : "/"} className="h-display text-xl">
            {APP_NAME}
          </Link>
          {viewerId ? (
            <Link href="/home" className="text-[15px] font-bold text-lime-ink">
              Open app
            </Link>
          ) : (
            <Link href="/login" className="text-[15px] font-bold">
              Log in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-5 pb-12 pt-5">
        <ProfileHeader
          id={p.id}
          avatar={<Avatar id={p.id} nickname={p.nickname} photoVersion={p.photo_version} size={84} />}
          name={
            <>
              <h1 className="h-display truncate text-2xl leading-tight">{p.nickname}</h1>
              {p.verified && <VerifiedBadge size={22} />}
              {!me && p.follows_you && (
                <span className="ml-1 shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-muted">Follows you</span>
              )}
            </>
          }
          username={p.nickname}
          meta={`${stageLine(p.nysc_stage, p.state, p.nysc_batch)} · Joined ${joinedOn(p.joined)}`}
          stats={
            <>
              <span>
                <span className="font-bold">{fmt(p.following)}</span> <span className="text-muted">Following</span>
              </span>
              <span>
                <span className="font-bold">{fmt(p.followers)}</span>{" "}
                <span className="text-muted">{p.followers === 1 ? "Follower" : "Followers"}</span>
              </span>
            </>
          }
          actions={
            me ? (
              <div className="flex flex-col gap-3 border-t border-line pt-4">
                <p className="text-sm text-muted">This is your profile. Share it so people can follow you.</p>
                <ShareProfile link={`${APP_URL}/u/${code.toLowerCase()}`} nickname={p.nickname} />
              </div>
            ) : viewerId ? (
              <FollowButton id={p.id} following={p.is_following} followsYou={p.follows_you} />
            ) : (
              <div className="flex flex-col gap-2.5">
                <Link href="/join" className="btn-primary h-12 text-[15px]">
                  Join {APP_NAME} to follow {p.nickname}
                </Link>
                <Link href="/login" className="btn-secondary h-12 text-[15px]">
                  Log in to follow
                </Link>
                <p className="text-center text-xs text-faint">You&apos;ll follow {p.nickname} as soon as you&apos;re in.</p>
              </div>
            )
          }
        />

        {!viewerId && (
          <section className="flex flex-col gap-1.5 rounded-3xl border border-line p-5">
            <h2 className="font-bold">What is {APP_NAME}?</h2>
            <p className="text-sm leading-relaxed text-muted">
              The free app for NYSC corps members across Nigeria. Find corpers serving in your state, follow friends, and win prizes,
              contests and awards made for corpers.{" "}
              <Link href="/" className="font-bold text-lime-ink">
                Learn more
              </Link>
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
