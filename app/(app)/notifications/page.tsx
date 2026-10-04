import type { Metadata } from "next";
import Link from "next/link";
import AnnouncementCard from "@/components/AnnouncementCard";
import Avatar from "@/components/Avatar";
import { PersonButton } from "@/components/PersonSheet";
import { ChevronLeft, GiftIcon, MedalIcon } from "@/components/icons";
import { sql } from "@/lib/db";
import { getAnnouncements, getNotifications, type Notification } from "@/lib/notifications";
import { requireUser } from "@/lib/session";
import { timeAgo } from "@/lib/util";
import MarkSeen from "./MarkSeen";

export const metadata: Metadata = { title: "Notifications" };

type Props = { searchParams: Promise<{ tab?: string }> };

function Row({ n, unread }: { n: Notification; unread: boolean }) {
  const icon = n.actor ? (
    <Avatar id={n.actor.id} nickname={n.actor.nickname} photoVersion={n.actor.photo_version} size={40} />
  ) : (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-lime-ink">
      {n.kind === "badge" ? <MedalIcon size={20} /> : <GiftIcon size={20} />}
    </span>
  );
  const content = (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold leading-snug">{n.title}</span>
        {n.body && <span className="block text-sm leading-snug text-muted">{n.body}</span>}
        <span className="mt-0.5 block text-xs text-faint">{timeAgo(n.created_at)}</span>
      </span>
      {unread && <span aria-label="New" className="mt-1.5 size-2 shrink-0 rounded-full bg-lime" />}
    </>
  );
  const cls = "flex w-full items-start gap-3 px-4 py-3.5 text-left active:bg-surface-2";
  if (n.actor) return <PersonButton id={n.actor.id} label={n.actor.nickname} className={cls}>{content}</PersonButton>;
  if (n.url) return <Link href={n.url} className={cls}>{content}</Link>;
  return <div className={cls}>{content}</div>;
}

export default async function NotificationsPage({ searchParams }: Props) {
  const user = await requireUser();
  const updates = (await searchParams).tab === "updates";
  const [[seen], notifications, announcements] = await Promise.all([
    sql<{ at: Date }[]>`SELECT notifications_seen_at AS at FROM users WHERE id = ${user.id}`,
    updates ? Promise.resolve([]) : getNotifications(user.id),
    updates ? getAnnouncements(30) : Promise.resolve([]),
  ]);
  const seenAt = seen?.at.getTime() ?? Date.now();

  return (
    <>
      <MarkSeen />
      <header className="flex h-11 items-center">
        <Link href="/home" className="-ml-2 flex items-center gap-1 py-2 pr-2 text-[15px] font-bold" aria-label="Back to Home">
          <ChevronLeft size={20} />
          Notifications
        </Link>
      </header>

      <nav aria-label="Notification types" className="-mt-1 grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
        {[
          { label: "For you", href: "/notifications", on: !updates },
          { label: "Updates", href: "/notifications?tab=updates", on: updates },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            replace
            scroll={false}
            aria-current={t.on ? "page" : undefined}
            className={`flex h-10 items-center justify-center rounded-full text-sm font-bold ${t.on ? "bg-bg text-ink" : "text-muted"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {updates ? (
        announcements.length === 0 ? (
          <p className="card text-[15px] text-muted">No updates from the Kopamate team yet.</p>
        ) : (
          <div className="card flex flex-col divide-y divide-line !p-0">
            {announcements.map((a) => (
              <AnnouncementCard key={a.id} a={a} />
            ))}
          </div>
        )
      ) : notifications.length === 0 ? (
        <div className="card flex flex-col gap-1 text-[15px]">
          <p className="font-bold">Nothing yet</p>
          <p className="text-muted">New followers, badges, rewards and friends who join with your link show up here.</p>
        </div>
      ) : (
        <div className="card flex flex-col divide-y divide-line !p-0">
          {notifications.map((n) => (
            <Row key={n.id} n={n} unread={new Date(n.created_at).getTime() > seenAt} />
          ))}
        </div>
      )}
    </>
  );
}
