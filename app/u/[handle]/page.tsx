import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import Avatar from "@/components/Avatar";
import ProfileHeader from "@/components/ProfileHeader";
import { ShareProfileButton } from "@/components/ShareProfile";
import VerifiedBadge from "@/components/VerifiedBadge";
import ProfileActions from "@/components/social/ProfileActions";
import { APP_NAME, APP_URL } from "@/lib/config";
import { getProfileByCode } from "@/lib/people";
import { getCurrentUser } from "@/lib/session";
import { getFullProfile, resolveProfilePath } from "@/lib/social";
import { handleFromPath, LINK_LABEL, LINK_KINDS, OPEN_TO_LABEL, profileStrength, type OpenTo } from "@/lib/social-rules";
import { track } from "@/lib/stats";
import { stageLine, type Stage } from "@/lib/nysc";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ handle: string }>; searchParams?: Promise<{ from?: string }> };

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
  const segment = (await params).handle;
  const r = await resolveProfilePath(segment, handleFromPath(segment));
  // Profiles stay out of search results for now (and the preview shows only what's already public).
  if (!r || r.kind === "redirect") return { title: "Profile", robots: { index: false, follow: false } };
  const p = await getProfileByCode(r.referral_code, null);
  if (!p) return { title: "Profile not found", robots: { index: false, follow: false } };
  const title = `Follow ${p.nickname} on ${APP_NAME}`;
  const description = `${p.nickname}${profileBlurb(p.nysc_stage, p.state)} on ${APP_NAME}, the free app for NYSC corps members. Join to follow them.`;
  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * Someone's profile.
 * - /u/@username: the full profile, for signed-in members. An old username redirects here for 30 days.
 * - /u/<invite code>: the share link. Logged out, a minimal preview (photo, name, state, Join to follow); the
 *   middleware remembers the code so sign-up credits and follows them. Logged in, it opens the full profile.
 */
export default async function ProfilePage({ params, searchParams }: Props) {
  const segment = (await params).handle;
  const from = (await searchParams)?.from;
  const handle = handleFromPath(segment);
  const [resolved, viewer] = await Promise.all([resolveProfilePath(segment, handle), getCurrentUser()]);
  const viewerId = viewer?.completed_at ? viewer.id : null;
  if (!resolved) notFound();
  if (resolved.kind === "redirect") redirect(`/u/@${resolved.nickname}`);
  if (!viewerId) {
    // The public preview lives on the invite-code link, so a sign-up from it credits this person.
    if (resolved.kind === "user") redirect(`/u/${resolved.referral_code}`);
    return <PublicPreview code={resolved.referral_code} />;
  }
  if (resolved.kind === "code") redirect(`/u/@${resolved.nickname}`);

  const p = await getFullProfile(resolved.id, viewerId);
  if (!p) notFound();
  const me = p.id === viewerId;
  if (!me) {
    after(async () => {
      await track("profile_view", viewerId);
      if (from === "plyc") await track("people_like_you_click", viewerId);
    });
  }

  const strength = me
    ? profileStrength({
        photo: p.photo_version > 0,
        bio: p.bio,
        school: p.school,
        course: p.course,
        interests: p.interests,
        open_to: p.open_to,
        links: p.links,
      })
    : null;
  const links = LINK_KINDS.filter((k) => p.links[k]);
  const mutual = p.is_following && p.follows_you;

  return (
    <>
      <ProfileHeader
        id={p.id}
        avatar={<Avatar id={p.id} nickname={p.nickname} photoVersion={p.photo_version} size={84} />}
        name={
          <>
            <h1 className="h-display truncate text-2xl leading-tight">{p.nickname}</h1>
            {p.verified && <VerifiedBadge size={22} />}
            {!me && (mutual || p.follows_you) && (
              <span className="ml-1 shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-muted">{mutual ? "Mutual" : "Follows you"}</span>
            )}
          </>
        }
        username={p.nickname}
        meta={`${stageLine(p.nysc_stage, p.state, p.nysc_batch)} · Joined ${joinedOn(p.joined)}`}
        stats={
          <>
            <Link href={`/u/@${p.nickname}/following`}>
              <span className="font-bold">{fmt(p.following)}</span> <span className="text-muted">Following</span>
            </Link>
            <Link href={`/u/@${p.nickname}/followers`}>
              <span className="font-bold">{fmt(p.followers)}</span> <span className="text-muted">{p.followers === 1 ? "Follower" : "Followers"}</span>
            </Link>
          </>
        }
        actions={
          me ? (
            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/profile/settings#about" className="flex h-10 items-center justify-center rounded-full border border-line text-[15px] font-bold">
                Edit profile
              </Link>
              <ShareProfileButton
                link={`${APP_URL}/u/${viewer!.referral_code}`}
                nickname={p.nickname}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-line text-[15px] font-bold"
              />
            </div>
          ) : (
            <ProfileActions
              id={p.id}
              nickname={p.nickname}
              following={p.is_following}
              followsYou={p.follows_you}
              connection={p.connection}
              wa={p.wa}
              hiAllowed={p.hi_allowed}
            />
          )
        }
      />

      {strength && strength.score < 100 && (
        <Link href="/profile/settings#about" className="card flex flex-col gap-2 !p-4">
          <span className="flex items-center justify-between text-sm">
            <span className="font-bold">Profile strength</span>
            <span className="text-muted">{strength.score}%</span>
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <span className="block h-full rounded-full bg-lime" style={{ width: `${Math.max(4, strength.score)}%` }} />
          </span>
          {strength.missing && <span className="text-sm text-muted">Next: {strength.missing.hint} ›</span>}
        </Link>
      )}

      {(p.bio || p.school || p.course) && (
        <section className="flex flex-col gap-1.5" aria-label="About">
          {p.bio && <p className="whitespace-pre-line text-[15px] leading-relaxed">{p.bio}</p>}
          {(p.school || p.course) && (
            <p className="text-sm text-muted">🎓 {[p.school, p.course].filter(Boolean).join(" · ")}</p>
          )}
        </section>
      )}

      {p.interests.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="interests-title">
          <h2 id="interests-title" className="text-xs font-bold tracking-wider text-faint uppercase">
            Interests
          </h2>
          <ul className="flex flex-wrap gap-2">
            {p.interests.map((i) => (
              <li key={i}>
                <Link href={`/corpers?interest=${encodeURIComponent(i)}`} className="block rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium">
                  {i}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.open_to.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="open-title">
          <h2 id="open-title" className="text-xs font-bold tracking-wider text-faint uppercase">
            Open to
          </h2>
          <ul className="flex flex-wrap gap-2">
            {p.open_to.map((o) => (
              <li key={o} className="rounded-full border border-lime/60 px-3 py-1.5 text-sm font-bold text-lime-ink">
                {OPEN_TO_LABEL[o as OpenTo] ?? o}
              </li>
            ))}
          </ul>
        </section>
      )}

      {links.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="links-title">
          <h2 id="links-title" className="text-xs font-bold tracking-wider text-faint uppercase">
            Links
          </h2>
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
            {links.map((k) => (
              <li key={k}>
                <a href={p.links[k]} target="_blank" rel="nofollow noopener ugc" className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="font-bold">{LINK_LABEL[k]}</span>
                  <span className="min-w-0 truncate text-sm text-muted">{p.links[k]!.replace(/^https:\/\/(www\.)?/, "")}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Logged out: only what was already public before (photo, name, state), and Join to follow. */
async function PublicPreview({ code }: { code: string }) {
  const p = await getProfileByCode(code, null);
  if (!p) notFound();
  return (
    <div className="min-h-screen-safe">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-[480px] items-center justify-between px-5">
          <Link href="/" className="h-display text-xl">
            {APP_NAME}
          </Link>
          <Link href="/login" className="text-[15px] font-bold">
            Log in
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-5 pt-5 pb-12">
        <ProfileHeader
          id={p.id}
          avatar={<Avatar id={p.id} nickname={p.nickname} photoVersion={p.photo_version} size={84} />}
          name={
            <>
              <h1 className="h-display truncate text-2xl leading-tight">{p.nickname}</h1>
              {p.verified && <VerifiedBadge size={22} />}
            </>
          }
          username={p.nickname}
          meta={stageLine(p.nysc_stage, p.state, p.nysc_batch)}
          stats={null}
          actions={
            <div className="flex flex-col gap-2.5">
              <Link href="/join" className="btn-primary h-12 text-[15px]">
                Join {APP_NAME} to follow {p.nickname}
              </Link>
              <Link href="/login" className="btn-secondary h-12 text-[15px]">
                Log in to follow
              </Link>
              <p className="text-center text-xs text-faint">You&apos;ll follow {p.nickname} as soon as you&apos;re in.</p>
            </div>
          }
        />
        <section className="flex flex-col gap-1.5 rounded-3xl border border-line p-5">
          <h2 className="font-bold">What is {APP_NAME}?</h2>
          <p className="text-sm leading-relaxed text-muted">
            The free app for NYSC corps members across Nigeria. Find corpers serving in your state, follow friends, and win prizes, contests
            and awards made for corpers.{" "}
            <Link href="/" className="font-bold text-lime-ink">
              Learn more
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
