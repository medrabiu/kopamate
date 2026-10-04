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
 * A post from the Kopamate team. `banner`: the pinned one at the top of Home (pink border, bigger title);
 * otherwise a row in the Updates list.
 */
export default function AnnouncementCard({ a, banner = false }: { a: Announcement; banner?: boolean }) {
  if (banner) {
    return (
      <section className="flex flex-col gap-2 rounded-3xl border-[1.5px] border-pink p-[22px]" aria-label="Announcement">
        <h2 className="h-display text-[22px] leading-tight text-pink-ink">{a.title}</h2>
        {a.body && <p className="text-[15px] leading-normal">{a.body}</p>}
        <Button a={a} className="mt-1 flex h-11 items-center justify-center self-start rounded-full bg-pink px-5 text-[15px] font-bold text-on-accent" />
      </section>
    );
  }
  return (
    <article className="flex flex-col gap-1.5 px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-pink" />
        Kopamate team · {timeAgo(a.created_at)}
      </p>
      <h3 className="font-bold leading-snug">{a.title}</h3>
      {a.body && <p className="text-sm leading-snug text-muted">{a.body}</p>}
      <Button a={a} className="mt-1 self-start text-sm font-bold text-lime-ink" />
    </article>
  );
}
