import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "../icons";
import PersonRow from "./PersonRow";
import { getCurrentUser } from "@/lib/session";
import { getFollowPage, getFullProfile, resolveProfilePath } from "@/lib/social";
import { handleFromPath } from "@/lib/social-rules";

/** /u/@name/followers and /following: 30 a page, signed-in members only, without anyone blocked or hidden. */
export default async function FollowListPage({ segment, list, page }: { segment: string; list: "followers" | "following"; page: number }) {
  const viewer = await getCurrentUser();
  if (!viewer?.completed_at) redirect("/login");
  const resolved = await resolveProfilePath(segment, handleFromPath(segment));
  if (!resolved) notFound();
  if (resolved.kind !== "user") redirect(`/u/@${resolved.nickname}/${list}`);
  const profile = await getFullProfile(resolved.id, viewer.id);
  if (!profile) notFound();
  const { rows, more } = await getFollowPage(profile.id, list, viewer.id, page);
  const base = `/u/@${profile.nickname}/${list}`;

  return (
    <>
      <header className="flex h-11 items-center">
        <Link href={`/u/@${profile.nickname}`} className="-ml-2 flex items-center gap-1 py-2 pr-2 text-[15px] font-bold">
          <ChevronLeft size={20} />
          {profile.nickname}
        </Link>
      </header>
      <nav className="grid grid-cols-2 border-b border-line" aria-label="Followers and following">
        {(["followers", "following"] as const).map((l) => (
          <Link
            key={l}
            href={`/u/@${profile.nickname}/${l}`}
            aria-current={l === list ? "page" : undefined}
            className={`py-3 text-center text-[15px] font-bold capitalize ${l === list ? "border-b-2 border-lime" : "text-muted"}`}
          >
            {l} · {l === "followers" ? profile.followers : profile.following}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-muted">{list === "followers" ? "No followers yet." : "Not following anyone yet."}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((p) => (
            <PersonRow key={p.id} p={p} viewerId={viewer.id} />
          ))}
        </ul>
      )}
      {(page > 1 || more) && (
        <div className="flex justify-between">
          {page > 1 ? (
            <Link href={`${base}?page=${page - 1}`} className="py-2 font-bold text-lime-ink">
              ‹ Newer
            </Link>
          ) : (
            <span />
          )}
          {more && (
            <Link href={`${base}?page=${page + 1}`} className="py-2 font-bold text-lime-ink">
              Older ›
            </Link>
          )}
        </div>
      )}
    </>
  );
}
