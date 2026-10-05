import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import CopyLink from "@/components/challenges/CopyLink";
import { ChevronLeft, ExternalIcon } from "@/components/icons";
import { removeEntry } from "@/app/actions/challenges";
import { APP_URL } from "@/lib/config";
import { requireUser } from "@/lib/session";
import { FORMAT_LABEL, PLATFORM_LABEL, type Format } from "@/lib/challenge-rules";
import { countsTowardLimit, getChallenge, getMyEntries, getParticipant, isOpen, metricsOpen, newEntryCode, type MyEntry } from "@/lib/challenges";
import EntryForm from "./EntryForm";
import MetricsForm from "./MetricsForm";

export const metadata: Metadata = { title: "My entries" };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ joined?: string }> };

const WHEN = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

function StatusLine({ e }: { e: MyEntry }) {
  if (e.status === "approved") return <span className="rounded-full bg-lime px-2.5 py-0.5 text-xs font-bold text-on-accent">Approved</span>;
  if (e.status === "pending") return <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-bold text-muted">Being checked</span>;
  return (
    <span className="rounded-full bg-pink px-2.5 py-0.5 text-xs font-bold text-on-accent">
      {e.status === "rejected" ? "Not accepted" : "Disqualified"}
    </span>
  );
}

export default async function MyEntriesPage({ params, searchParams }: Props) {
  const user = await requireUser();
  const c = await getChallenge((await params).slug);
  if (!c) notFound();
  const { joined } = await searchParams;
  const participant = await getParticipant(c.id, user.id);
  if (!participant) redirect(`/challenges/${c.slug}/join`);
  const entries = await getMyEntries(c.id, user.id);
  const used = entries.filter(countsTowardLimit).length;
  const open = isOpen(c);
  const canAdd = open && used < c.max_entries_per_user;
  const code = canAdd ? await newEntryCode() : "";

  return (
    <>
      <Link href={`/challenges/${c.slug}`} className="-mb-2 flex items-center gap-1 self-start text-sm font-medium text-muted">
        <ChevronLeft size={16} /> {c.title}
      </Link>
      <div className="flex items-end justify-between gap-3">
        <h1 className="h-display text-[28px]">My entries</h1>
        <Link href={`/challenges/${c.slug}/join`} className="py-1 text-sm font-medium text-lime-ink">
          My handles
        </Link>
      </div>

      {joined === "1" && (
        <p role="status" className="rounded-2xl border border-lime px-4 py-3 text-[15px]">
          <span className="font-bold">You&apos;re in 🎉</span> Now make something great and add your post link below.
        </p>
      )}

      {entries.map((e, i) => (
        <article key={e.id} className="card flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold">
              Entry {i + 1} · {PLATFORM_LABEL[e.platform]} {FORMAT_LABEL[e.format as Format]?.toLowerCase()}
            </h2>
            <StatusLine e={e} />
          </div>
          {e.status === "rejected" && e.reject_reason && <p className="text-sm text-pink-ink">{e.reject_reason}</p>}
          <a href={e.post_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 truncate text-sm text-muted underline">
            <span className="truncate">{e.post_url.replace(/^https:\/\/(www\.)?/, "")}</span>
            <ExternalIcon size={14} className="shrink-0" />
          </a>
          <CopyLink url={`${APP_URL}/c/${e.entry_code}`} />
          <p className="text-[15px]">
            <span className="h-display text-lime-ink">{e.joined}</span> {e.joined === 1 ? "person" : "people"} joined through this link
          </p>
          {metricsOpen(c, e) ? (
            <MetricsForm
              slug={c.slug}
              entryId={e.id}
              initial={{ views: e.views, likes: e.likes, comments: e.comments, shares: e.shares }}
              hasStats={Boolean(e.metrics_submitted_at)}
            />
          ) : (
            e.status !== "rejected" &&
            e.status !== "disqualified" &&
            !c.published_at && (
              <p className="text-sm text-faint">
                You can add your post stats from {WHEN.format(new Date(e.submitted_at.getTime() + c.metrics_due_hours * 3_600_000))}.
              </p>
            )
          )}
          {(e.status === "pending" || e.status === "rejected") && (
            <form action={removeEntry}>
              <input type="hidden" name="slug" value={c.slug} />
              <input type="hidden" name="entry_id" value={e.id} />
              <button className="text-sm font-medium text-muted underline">Remove this entry</button>
            </form>
          )}
        </article>
      ))}

      {canAdd ? (
        <EntryForm
          slug={c.slug}
          code={code}
          appUrl={APP_URL}
          number={used + 1}
          max={c.max_entries_per_user}
          tag={c.required_tags.x ?? "@kopamate"}
          hashtag={c.hashtag}
        />
      ) : open ? (
        <p className="text-center text-sm text-muted">You&apos;ve used all {c.max_entries_per_user} entries. Good luck!</p>
      ) : c.status === "upcoming" || (c.opens_at && c.opens_at.getTime() > Date.now()) ? (
        <p className="card text-center text-muted">
          Entries open {c.opens_at ? WHEN.format(c.opens_at) : "soon"}. Start making your post now.
        </p>
      ) : (
        <p className="card text-center text-muted">Entries are closed.</p>
      )}
    </>
  );
}
