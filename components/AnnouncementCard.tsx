import type { Announcement } from "@/lib/notifications";
import { timeAgo } from "@/lib/util";

/** Links are in-app ("/…") or https; outside links open in a new tab. */
function Button({ a, className }: { a: Announcement; className: string }) {
  if (!a.button_label || !a.button_url) return null;
  const external = a.button_url.startsWith("https://");
  return (
    <a href={a.button_url} {...(external ? { target: "_blank", rel: "noopener" } : {})} className={className}>
      {a.button_label}
    </a>
  );
}

/**
 * A post from the Kopamate team. `slide`: one card of the Home carousel (pink border, bigger title);
 * otherwise a row in Notifications.
 */
export default function AnnouncementCard({ a, slide = false, unread = false }: { a: Announcement; slide?: boolean; unread?: boolean }) {
  if (slide) {
    return (
      <article className="flex h-full flex-col gap-2 rounded-3xl border-[1.5px] border-pink p-5">
        <p className="flex items-center gap-1.5 text-xs font-bold text-pink-ink">
          📣 Kopamate team
          <span className="font-normal text-muted">· {timeAgo(a.created_at)}</span>
        </p>
        <h3 className="h-display text-[21px] leading-tight">{a.title}</h3>
        {a.body && <p className="line-clamp-3 text-[15px] leading-normal text-muted">{a.body}</p>}
        <Button
          a={a}
          className="mt-auto flex h-11 items-center justify-center self-start rounded-full bg-pink px-5 text-[15px] font-bold text-on-accent"
        />
      </article>
    );
  }
  return (
    <article className="flex items-start gap-3 px-4 py-3.5">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-lg">
        📣
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[15px] font-bold leading-snug">{a.title}</span>
        {a.body && <span className="text-sm leading-snug text-muted">{a.body}</span>}
        <span className="text-xs text-faint">Kopamate team · {timeAgo(a.created_at)}</span>
        <Button a={a} className="self-start text-sm font-bold text-lime-ink" />
      </span>
      {unread && <span aria-label="New" className="mt-1.5 size-2 shrink-0 rounded-full bg-lime" />}
    </article>
  );
}
