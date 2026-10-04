import { KIND_META } from "@/lib/announcement-meta";
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
 * A post from the Kopamate team, labelled and coloured by its type. `slide`: one card of the Home carousel;
 * otherwise a row in Notifications.
 */
export default function AnnouncementCard({ a, slide = false, unread = false }: { a: Announcement; slide?: boolean; unread?: boolean }) {
  const meta = KIND_META[a.kind] ?? KIND_META.general;
  const lime = meta.accent === "lime";
  if (slide) {
    return (
      <article className={`flex h-full flex-col gap-2 rounded-3xl border-[1.5px] p-5 ${lime ? "border-lime" : "border-pink"}`}>
        <p className={`flex items-center gap-1.5 text-xs font-bold ${lime ? "text-lime-ink" : "text-pink-ink"}`}>
          {meta.emoji} {meta.label}
          <span className="font-normal text-muted">· {timeAgo(a.published_at)}</span>
        </p>
        <h3 className="h-display text-[21px] leading-tight">{a.title}</h3>
        {a.body && <p className="line-clamp-3 text-[15px] leading-normal text-muted">{a.body}</p>}
        <Button
          a={a}
          className={`mt-auto flex h-11 items-center justify-center self-start rounded-full px-5 text-[15px] font-bold text-on-accent ${lime ? "bg-lime" : "bg-pink"}`}
        />
      </article>
    );
  }
  return (
    <article className="flex items-start gap-3 px-4 py-3.5">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-lg">
        {meta.emoji}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[15px] font-bold leading-snug">{a.title}</span>
        {a.body && <span className="text-sm leading-snug text-muted">{a.body}</span>}
        <span className="text-xs text-faint">
          {meta.label} · {timeAgo(a.published_at)}
        </span>
        <Button a={a} className="self-start text-sm font-bold text-lime-ink" />
      </span>
      {unread && <span aria-label="New" className="mt-1.5 size-2 shrink-0 rounded-full bg-lime" />}
    </article>
  );
}
