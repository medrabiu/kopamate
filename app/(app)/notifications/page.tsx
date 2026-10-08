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
import { after } from "next/server";
import HiResponse from "@/components/social/HiResponse";
import SmallFollow from "@/components/social/SmallFollow";
import { track } from "@/lib/stats";

export const metadata: Metadata = { title: "Notifications" };

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
  // Inline actions: answer a "Say hi" while it's waiting, or follow back.
  const waiting = n.kind === "hi_request" && n.actor && n.connection?.status === "pending";
  const followBack = n.kind === "follow" && n.actor && !n.following_actor;
  const actions =
    waiting || followBack ? (
      <div className="-mt-1.5 pr-4 pb-3.5 pl-[68px]">
        {waiting ? <HiResponse connectionId={n.connection!.id} nickname={n.actor!.nickname} /> : <SmallFollow id={n.actor!.id} following={false} />}
      </div>
    ) : null;
  const main = n.actor ? (
    <PersonButton id={n.actor.id} label={n.actor.nickname} className={cls}>
      {content}
    </PersonButton>
  ) : n.url ? (
    <Link href={n.url} className={cls}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
  return actions ? (
    <div>
      {main}
      {actions}
    </div>
  ) : (
    main
  );
}

/** One list, newest first: personal notifications and Kopamate team announcements from the last 30 days. */
export default async function NotificationsPage() {
  const user = await requireUser();
  const [[seen], notifications, announcements] = await Promise.all([
    sql<{ at: Date }[]>`SELECT notifications_seen_at AS at FROM users WHERE id = ${user.id}`,
    getNotifications(user.id),
    getAnnouncements(30),
  ]);
  const seenAt = seen?.at.getTime() ?? Date.now();
  after(() => track("notification_open", user.id));
  const monthAgo = Date.now() - 30 * 86_400_000;
  const items = [
    ...notifications.map((n) => ({ type: "personal" as const, at: new Date(n.created_at).getTime(), n })),
    ...announcements
      .filter((a) => new Date(a.published_at).getTime() > monthAgo)
      .map((a) => ({ type: "announcement" as const, at: new Date(a.published_at).getTime(), a })),
  ].sort((x, y) => y.at - x.at);

  return (
    <>
      <MarkSeen />
      <header className="flex h-11 items-center">
        <Link href="/home" className="-ml-2 flex items-center gap-1 py-2 pr-2 text-[15px] font-bold" aria-label="Back to Home">
          <ChevronLeft size={20} />
          Notifications
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="card flex flex-col gap-1 text-[15px]">
          <p className="font-bold">Nothing yet</p>
          <p className="text-muted">Updates from the Kopamate team, new followers, badges, rewards and friends who join with your link show up here.</p>
        </div>
      ) : (
        <div className="card flex flex-col divide-y divide-line !p-0">
          {items.map((item) =>
            item.type === "announcement" ? (
              <AnnouncementCard key={`a${item.a.id}`} a={item.a} unread={item.at > seenAt} />
            ) : (
              <Row key={`n${item.n.id}`} n={item.n} unread={item.at > seenAt} />
            ),
          )}
        </div>
      )}
    </>
  );
}
