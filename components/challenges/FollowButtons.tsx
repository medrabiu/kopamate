import { ExternalIcon } from "../icons";
import type { Challenge } from "@/lib/challenges";

const ITEMS = [
  { key: "x", label: "X" },
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
  { key: "whatsapp", label: "WhatsApp Channel" },
] as const;

/** Our accounts from the challenge's social links (set in admin). Links that aren't set are left out. The handles to tag are in the copy. */
export default function FollowButtons({ links }: { links: Challenge["social_links"] }) {
  const items = ITEMS.filter((i) => links[i.key]?.startsWith("https://"));
  if (items.length === 0) return <p className="text-sm text-muted">Our social links are coming soon.</p>;
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((i) => (
        <a
          key={i.key}
          href={links[i.key]}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center justify-between gap-2 rounded-2xl border border-line px-3.5 text-sm font-bold hover:bg-surface-2"
        >
          <span className="min-w-0 truncate">{i.label}</span>
          <ExternalIcon size={16} className="shrink-0 text-muted" />
        </a>
      ))}
    </div>
  );
}
