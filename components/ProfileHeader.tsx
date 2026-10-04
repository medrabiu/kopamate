import { avatarColor } from "@/lib/avatar";

/**
 * X/Instagram-style profile top: a cover tinted with the person's own colour, the avatar overlapping it,
 * then name, @username, where they serve and stats. Shared by your Profile and public profile links (/u/…).
 * `avatar` is passed in so your own profile can use the photo picker; `actions` sits under the stats.
 */
export default function ProfileHeader({
  id,
  avatar,
  name,
  username,
  meta,
  stats,
  actions,
}: {
  id: string;
  avatar: React.ReactNode;
  name: React.ReactNode;
  username: string;
  meta: string;
  stats: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const color = avatarColor(id);
  return (
    <section className="flex flex-col" aria-label={`${username}'s profile`}>
      <div
        aria-hidden="true"
        className="relative h-28 overflow-hidden rounded-3xl bg-surface-2"
        style={{ backgroundImage: `linear-gradient(135deg, ${color} 0%, ${color}66 45%, transparent 100%)` }}
      >
        <svg viewBox="0 0 400 112" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full opacity-60">
          <circle cx="340" cy="20" r="70" fill="#FF4FA3" opacity="0.18" />
          <circle cx="60" cy="120" r="60" fill="#C6F432" opacity="0.15" />
          <path transform="translate(320 70) scale(1.4)" d="M0-7 1.8-1.8 7 0 1.8 1.8 0 7-1.8 1.8-7 0-1.8-1.8Z" fill="#0E0E10" opacity="0.35" />
          <path transform="translate(372 36) scale(0.9)" d="M0-7 1.8-1.8 7 0 1.8 1.8 0 7-1.8 1.8-7 0-1.8-1.8Z" fill="#0E0E10" opacity="0.3" />
        </svg>
      </div>
      <div className="relative z-10 -mt-11 px-1">
        <div className="inline-block rounded-full border-4 border-bg bg-bg">{avatar}</div>
      </div>
      <div className="mt-2 flex flex-col gap-1 px-1">
        <div className="flex min-w-0 items-center gap-1.5">{name}</div>
        <p className="text-[15px] text-muted">@{username}</p>
        <p className="text-[15px] text-muted">{meta}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[15px]">{stats}</div>
      </div>
      {actions && <div className="mt-4">{actions}</div>}
    </section>
  );
}
