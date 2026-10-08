import Link from "next/link";
import Avatar from "../Avatar";
import VerifiedBadge from "../VerifiedBadge";
import SmallFollow from "./SmallFollow";
import type { PersonCard } from "@/lib/social";

/** One person in a list: avatar, name, school or state, and a Follow button. Tapping opens their profile. */
export default function PersonRow({ p, viewerId, note, onClickEvent }: { p: PersonCard; viewerId: string; note?: string | null; onClickEvent?: string }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Link href={`/u/@${p.nickname}${onClickEvent ? `?from=${onClickEvent}` : ""}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar id={p.id} nickname={p.nickname} photoVersion={p.photo_version} size={44} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 font-bold">
            <span className="truncate">{p.nickname}</span>
            {p.verified && <VerifiedBadge size={15} />}
          </span>
          <span className="block truncate text-sm text-muted">{note ?? p.school ?? p.state ?? ""}</span>
        </span>
      </Link>
      {p.id !== viewerId && <SmallFollow id={p.id} following={p.is_following} />}
    </li>
  );
}
