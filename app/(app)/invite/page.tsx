import type { Metadata } from "next";
import Avatar from "@/components/Avatar";
import ShareButtons from "@/components/ShareButtons";
import { requireUser } from "@/lib/session";
import { getReferrerRank, getTopReferrers } from "@/lib/ranking";
import { PLACES_PER_REFERRAL, TOP_REFERRERS, referralLink, shareMessage, whatsappShareUrl } from "@/lib/config";
import { sql } from "@/lib/db";
import { timeAgo } from "@/lib/util";

export const metadata: Metadata = { title: "Invite friends" };

export default async function InvitePage() {
  const user = await requireUser();
  const [joined, top, mine] = await Promise.all([
    sql<{ id: string; nickname: string; photo_version: number; completed_at: Date }[]>`
      SELECT id, nickname, photo_version, completed_at FROM users
      WHERE referred_by = ${user.id} AND completed_at IS NOT NULL AND NOT is_banned AND NOT is_flagged
      ORDER BY completed_at DESC LIMIT 100
    `,
    getTopReferrers(TOP_REFERRERS),
    getReferrerRank(user.id),
  ]);
  const inTop = top.some((r) => r.id === user.id);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="h-display text-[28px]">Invite friends</h1>
        <p className="text-[15px] leading-normal text-muted">
          Every friend who joins with your link moves you <span className="font-bold text-lime">up {PLACES_PER_REFERRAL} places</span>.
        </p>
      </div>

      <section className="card !p-[18px]">
        <ShareButtons
          variant="full"
          link={referralLink(user.referral_code)}
          whatsappUrl={whatsappShareUrl(user.referral_code)}
          message={shareMessage(user.referral_code)}
        />
      </section>

      <section className="flex flex-col gap-1.5">
        <h2 className="h-display text-xl">Joined with your link · {joined.length}</h2>
        {joined.length === 0 ? (
          <p className="py-3 text-sm text-muted">No one yet. Share your link on your WhatsApp Status to get started.</p>
        ) : (
          <ul>
            {joined.map((j, i) => (
              <li key={j.id} className={`flex h-14 items-center gap-3 ${i < joined.length - 1 ? "border-b border-surface-2" : ""}`}>
                <Avatar id={j.id} nickname={j.nickname} photoVersion={j.photo_version} size={40} />
                <span className="flex-1 truncate font-medium">{j.nickname}</span>
                <span className="text-[13px] text-faint">{timeAgo(j.completed_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="h-display text-xl">Top referrers</h2>
          <span className="rounded-full bg-pink px-2.5 py-1 text-xs font-bold text-bg">Top {TOP_REFERRERS} win prizes</span>
        </div>
        {top.length === 0 ? (
          <p className="rounded-[20px] bg-surface px-4 py-5 text-sm text-muted">Be the first on the board. Invite a friend.</p>
        ) : (
          <ol className="rounded-[20px] bg-surface px-4 py-1.5">
            {top.map((r, i) => {
              const me = r.id === user.id;
              return (
                <li key={r.id} className={`flex h-14 items-center gap-3 ${i < top.length - 1 ? "border-b border-surface-2" : ""}`}>
                  <span className={`h-display w-6 ${r.rank <= 3 ? "text-lime" : "text-faint"}`}>{r.rank}</span>
                  <Avatar id={r.id} nickname={r.nickname} photoVersion={r.photo_version} size={40} />
                  <span className={`flex-1 truncate ${me ? "font-bold text-lime" : "font-medium"}`}>
                    {me ? "You" : r.nickname}
                    {r.state ? <span className="text-muted"> · {r.state}</span> : null}
                  </span>
                  <span className="font-bold">{r.refs}</span>
                </li>
              );
            })}
          </ol>
        )}
        {!inTop && (
          <div className="flex h-14 items-center gap-3 rounded-2xl border-[1.5px] border-lime px-4">
            <span className="h-display text-lime">{mine ? mine.rank : "–"}</span>
            <Avatar id={user.id} nickname={user.nickname} photoVersion={user.photo_version} size={40} />
            <span className="flex-1 font-bold">You</span>
            <span className="font-bold">{mine?.refs ?? 0}</span>
          </div>
        )}
      </section>
    </>
  );
}
