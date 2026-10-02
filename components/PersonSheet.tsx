"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "./Avatar";
import BadgeChip from "./BadgeChip";
import Sheet from "./Sheet";
import { CheckIcon, ChevronRight } from "./icons";
import type { PublicProfile } from "@/lib/people";
import { stateSlug } from "@/lib/states";

const joinedOn = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso));

type Ctx = (id: string) => void;
const OpenPerson = createContext<Ctx | null>(null);

/**
 * One shared profile sheet for the signed-in app. Any avatar wrapped in <PersonButton> opens it;
 * the public profile is fetched when tapped (and kept for this visit), so lists stay light.
 */
export function PeopleProvider({ viewerId, children }: { viewerId: string; children: React.ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const cache = useRef(new Map<string, PublicProfile>());
  const path = usePathname();

  const open = useCallback((next: string) => setId(next), []);

  useEffect(() => {
    if (!id) return;
    setFailed(false);
    const hit = cache.current.get(id);
    setProfile(hit ?? null);
    if (hit) return;
    let live = true;
    fetch(`/api/person/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p: PublicProfile) => {
        cache.current.set(p.id, p);
        if (live) setProfile(p);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [id]);

  const me = profile?.id === viewerId;
  return (
    <OpenPerson.Provider value={open}>
      {children}
      <Sheet open={id !== null} onClose={() => setId(null)} title={profile?.nickname ?? "Corper"}>
        {failed ? (
          <p className="text-sm text-muted">Couldn&apos;t load this profile. Check your connection and try again.</p>
        ) : !profile ? (
          <div className="flex animate-pulse flex-col gap-3" aria-label="Loading">
            <div className="size-20 rounded-full bg-surface-2" />
            <div className="h-4 w-1/2 rounded bg-surface-2" />
            <div className="h-16 rounded-2xl bg-surface-2" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Avatar id={profile.id} nickname={profile.nickname} photoVersion={profile.photo_version} size={80} ring={me} />
              <div className="min-w-0">
                <div className="text-sm text-muted">
                  {profile.state ?? "No state"} · Joined {joinedOn(profile.joined)}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {me && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold">You</span>}
                  {profile.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-lime px-2 py-0.5 text-xs font-bold text-on-accent">
                      <CheckIcon size={12} strokeWidth={3} />
                      Verified corper
                    </span>
                  )}
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-3 divide-x divide-surface-2 rounded-2xl bg-surface-2/60 py-3">
              {(
                [
                  [profile.position ? `#${new Intl.NumberFormat("en-NG").format(profile.position)}` : "–", "Position"],
                  [String(profile.refs), profile.refs === 1 ? "Friend invited" : "Friends invited"],
                  [String(profile.badges.length), profile.badges.length === 1 ? "Badge" : "Badges"],
                ] as const
              ).map(([value, label]) => (
                <div key={label} className="flex flex-col-reverse items-center gap-0.5 px-1 text-center">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="h-display text-xl leading-tight">{value}</dd>
                </div>
              ))}
            </dl>

            {profile.badges.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Badges">
                {profile.badges.map((b) => (
                  <li key={b.slug} title={b.description}>
                    <BadgeChip badge={b} />
                  </li>
                ))}
              </ul>
            )}

            {profile.state && path !== `/corpers/${stateSlug(profile.state)}` && (
              <Link
                href={`/corpers/${stateSlug(profile.state)}`}
                onClick={() => setId(null)}
                className="flex h-12 items-center justify-between rounded-full bg-surface-2 pl-4 pr-3 text-[15px] font-bold"
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
  const open = useContext(OpenPerson);
  if (!open) return <span className={className}>{children}</span>;
  return (
    <button type="button" onClick={() => open(id)} aria-label={`View ${label}'s profile`} className={`text-left ${className}`}>
      {children}
    </button>
  );
}
