"use client";

import { createContext, useCallback, useContext, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Avatar from "./Avatar";
import VerifiedBadge from "./VerifiedBadge";
import Sheet from "./Sheet";
import { ChevronLeft, ChevronRight } from "./icons";
import { setFollow } from "@/app/actions/follows";
import type { FollowRow, PublicProfile } from "@/lib/people";
import { stateSlug } from "@/lib/states";
import { stageLine } from "@/lib/nysc";

const joinedOn = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso));
const fmt = (n: number) => new Intl.NumberFormat("en-NG").format(n);

type View = "profile" | "followers" | "following";
type Ctx = (id: string, view?: View) => void;
const OpenPerson = createContext<Ctx | null>(null);

/** Opens someone's profile sheet (or their followers / following list) from anywhere in the app. */
export function useOpenPerson() {
  return useContext(OpenPerson);
}

/**
 * One shared profile sheet for the signed-in app. Any avatar wrapped in <PersonButton> opens it.
 * It shows a normal profile (photo, name, state, joined, verified, follows) with a Follow button,
 * and switches in place to someone's followers or following, so sheets never stack.
 */
export function PeopleProvider({ viewerId, children }: { viewerId: string; children: React.ReactNode }) {
  const [target, setTarget] = useState<{ id: string; view: View } | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [list, setList] = useState<FollowRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const path = usePathname();
  const router = useRouter();

  const open = useCallback<Ctx>((id, view = "profile") => setTarget({ id, view }), []);
  const targetId = target?.id;

  // The profile is always fetched fresh: follow counts change with every tap.
  useEffect(() => {
    if (!targetId) return;
    let live = true;
    setFailed(false);
    setError(null);
    setProfile((p) => (p?.id === targetId ? p : null));
    fetch(`/api/person/${targetId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p: PublicProfile) => live && setProfile(p))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [targetId]);

  useEffect(() => {
    if (!target || target.view === "profile") return;
    let live = true;
    setList(null);
    fetch(`/api/person/${target.id}?list=${target.view}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows: FollowRow[]) => live && setList(rows))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [target]);

  function toggleFollow() {
    if (!profile) return;
    const before = profile;
    const next = !before.is_following;
    // Show the change straight away; undo it if the server says no.
    setProfile({ ...before, is_following: next, followers: before.followers + (next ? 1 : -1) });
    setError(null);
    start(async () => {
      const res = await setFollow(before.id, next);
      if ("error" in res) {
        setProfile(before);
        setError(res.error);
      } else {
        setProfile((p) => (p && p.id === before.id ? { ...p, followers: res.followers } : p));
        if (path === "/profile") router.refresh();
      }
    });
  }

  const me = profile?.id === viewerId;
  const view = target?.view ?? "profile";
  const title = view === "profile" ? (profile?.nickname ?? "Corper") : view === "followers" ? "Followers" : "Following";

  return (
    <OpenPerson.Provider value={open}>
      {children}
      <Sheet open={target !== null} onClose={() => setTarget(null)} title={title}>
        {failed ? (
          <p className="text-sm text-muted">Couldn&apos;t load this. Check your connection and try again.</p>
        ) : view !== "profile" ? (
          <div className="flex flex-col gap-2">
            {profile && (
              <button
                type="button"
                onClick={() => setTarget({ id: profile.id, view: "profile" })}
                className="-mt-1 flex items-center gap-1 self-start py-1 text-sm font-bold text-muted"
              >
                <ChevronLeft size={16} />
                {me ? "Your profile" : profile.nickname}
              </button>
            )}
            {!list ? (
              <div className="flex animate-pulse flex-col gap-3" aria-label="Loading">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 rounded-2xl bg-surface-2" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <p className="py-4 text-sm text-muted">
                {view === "followers"
                  ? me
                    ? "You don't have followers yet."
                    : "No followers yet."
                  : me
                    ? "You aren't following anyone yet."
                    : "Not following anyone yet."}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {list.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setTarget({ id: p.id, view: "profile" })}
                      className="flex w-full items-center gap-3 py-2.5 text-left"
                    >
                      <Avatar id={p.id} nickname={p.nickname} photoVersion={p.photo_version} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-1 font-bold">
                          <span className="truncate">{p.id === viewerId ? "You" : p.nickname}</span>
                          {p.verified && <VerifiedBadge />}
                        </span>
                        {p.state && <span className="block truncate text-sm text-muted">{p.state}</span>}
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-faint" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : !profile ? (
          <div className="flex animate-pulse flex-col gap-3" aria-label="Loading">
            <div className="size-20 rounded-full bg-surface-2" />
            <div className="h-4 w-1/2 rounded bg-surface-2" />
            <div className="h-11 rounded-full bg-surface-2" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <Avatar id={profile.id} nickname={profile.nickname} photoVersion={profile.photo_version} size={76} ring={me} />
              {!me && (
                <button
                  type="button"
                  onClick={toggleFollow}
                  disabled={pending}
                  aria-pressed={profile.is_following}
                  className={`group h-10 min-w-[108px] rounded-full px-5 text-[15px] font-bold transition-colors ${
                    profile.is_following
                      ? "border border-line text-ink hover:border-pink hover:text-pink-ink"
                      : "bg-ink text-bg hover:opacity-90"
                  }`}
                >
                  {profile.is_following ? (
                    <>
                      <span className="group-hover:hidden">Following</span>
                      <span className="hidden group-hover:inline">Unfollow</span>
                    </>
                  ) : profile.follows_you ? (
                    "Follow back"
                  ) : (
                    "Follow"
                  )}
                </button>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="h-display text-xl">{profile.nickname}</span>
                  {profile.verified && <VerifiedBadge size={20} />}
                </span>
                {me && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold">You</span>}
                {!me && profile.follows_you && (
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-muted">Follows you</span>
                )}
              </div>
              <div className="mt-1 text-[15px] text-muted">
                {stageLine(profile.nysc_stage, profile.state, profile.nysc_batch)} · Joined {joinedOn(profile.joined)}
              </div>
            </div>

            <div className="flex gap-5 text-[15px]">
              <button type="button" onClick={() => setTarget({ id: profile.id, view: "following" })} className="hover:underline">
                <span className="font-bold">{fmt(profile.following)}</span> <span className="text-muted">Following</span>
              </button>
              <button type="button" onClick={() => setTarget({ id: profile.id, view: "followers" })} className="hover:underline">
                <span className="font-bold">{fmt(profile.followers)}</span>{" "}
                <span className="text-muted">{profile.followers === 1 ? "Follower" : "Followers"}</span>
              </button>
            </div>

            {error && (
              <p role="alert" className="text-sm text-pink-ink">
                {error}
              </p>
            )}

            {profile.state && path !== `/corpers/${stateSlug(profile.state)}` && (
              <Link
                href={`/corpers/${stateSlug(profile.state)}`}
                onClick={() => setTarget(null)}
                className="flex h-12 items-center justify-between rounded-full border border-line pl-4 pr-3 text-[15px] font-bold"
              >
                See corpers in {profile.state}
                <ChevronRight size={18} className="text-lime-ink" />
              </Link>
            )}
          </div>
        )}
      </Sheet>
    </OpenPerson.Provider>
  );
}

/** Makes an avatar (or a whole row) open that person's profile sheet. Plain content outside the provider. */
export function PersonButton({
  id,
  label,
  className = "",
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  // Every avatar opens the person's full profile page (/u/@username). `id` is kept for callers.
  void id;
  return (
    <Link href={`/u/@${label}`} aria-label={`View ${label}'s profile`} className={`text-left ${className}`}>
      {children}
    </Link>
  );
}
