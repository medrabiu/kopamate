import type { Metadata } from "next";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import Countdown from "@/components/Countdown";
import { PersonButton } from "@/components/PersonSheet";
import { ChevronLeft } from "@/components/icons";
import { sql } from "@/lib/db";
import { getMyLeagueRank, getStandings, getTopPlayers, MIN_MEMBERS, weekEndsAt, weekStart, type PlayerRow } from "@/lib/league";
import { getQuizStatus } from "@/lib/quiz";
import { requireUser } from "@/lib/session";
import { formatNumber } from "@/lib/util";

export const metadata: Metadata = { title: "State League" };

const fmtScore = (n: number) => n.toFixed(1);

function Players({ title, rows, me, myRow }: { title: string; rows: PlayerRow[]; me: string; myRow: { rank: number; points: number } | null }) {
  const meInList = rows.some((r) => r.id === me);
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="h-display text-xl">{title}</h2>
      {rows.length === 0 ? (
        <p className="card text-[15px] text-muted">Nobody has played this week yet. Be first.</p>
      ) : (
        <ol className="card flex flex-col !p-0">
          {rows.map((r) => (
            <li key={r.id} className={`flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 ${r.id === me ? "bg-surface-2" : ""}`}>
              <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-muted">{r.rank}</span>
              <PersonButton id={r.id} label={r.nickname} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Avatar id={r.id} nickname={r.nickname} photoVersion={r.photo_version} size={36} />
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-1 text-[15px] font-bold">
                    <span className="truncate">{r.id === me ? "You" : r.nickname}</span>
                    {r.verified && <VerifiedBadge />}
                  </span>
                  <span className="block truncate text-[13px] text-muted">
                    {r.state} · {r.days} {r.days === 1 ? "day" : "days"}
                  </span>
                </span>
              </PersonButton>
              <span className="shrink-0 text-[15px] font-bold tabular-nums">{formatNumber(r.points)}</span>
            </li>
          ))}
          {!meInList && myRow && (
            <li className="flex items-center gap-3 bg-surface-2 px-4 py-2.5">
              <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-muted">{myRow.rank}</span>
              <span className="flex-1 text-[15px] font-bold">You</span>
              <span className="shrink-0 text-[15px] font-bold tabular-nums">{formatNumber(myRow.points)}</span>
            </li>
          )}
        </ol>
      )}
    </section>
  );
}

export default async function LeaguePage() {
  const user = await requireUser();
  const week = weekStart();
  const myState = user.state ?? "";
  const [standings, national, local, mine, quiz, [last]] = await Promise.all([
    getStandings(week),
    getTopPlayers(week, null, 10),
    getTopPlayers(week, myState, 10),
    getMyLeagueRank(week, user.id),
    getQuizStatus(user.id),
    sql<{ winner_state: string | null; week: string }[]>`
      SELECT winner_state, week::text FROM league_weeks ORDER BY week DESC LIMIT 1
    `,
  ]);
  const ranked = standings.filter((s) => s.rank !== null);
  const unranked = standings.filter((s) => s.rank === null && s.members > 0);
  const me = standings.find((s) => s.state === myState);
  const above = me?.rank ? ranked[me.rank - 2] : undefined;
  const below = me?.rank ? ranked[me.rank] : undefined;

  return (
    <>
      <header className="flex h-11 items-center justify-between">
        <Link href="/home" className="-ml-2 flex items-center gap-1 py-2 pr-2 text-[15px] font-bold" aria-label="Back to Home">
          <ChevronLeft size={20} />
          State League
        </Link>
        <span className="text-[13px] text-muted">
          Ends in <Countdown to={weekEndsAt(week)} className="font-bold text-ink" />
        </span>
      </header>

      {me && (
        <section className="card flex flex-col gap-4 !p-[22px]" aria-label={`${myState} this week`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted">{myState} this week</p>
              <p className="h-display text-[56px] leading-[0.95] text-lime-ink">{me.rank ? `#${me.rank}` : "–"}</p>
            </div>
            <div className="text-right">
              <p className="h-display text-2xl">{fmtScore(me.score)}</p>
              <p className="text-[13px] text-muted">pts per corper</p>
            </div>
          </div>
          <p className="text-[15px]">
            {!me.rank
              ? `${myState} needs ${MIN_MEMBERS} corpers to be ranked. It has ${me.members}. Invite friends to get in.`
              : above
                ? `${fmtScore(above.score - me.score)} pts per corper behind ${above.state} (#${above.rank}).`
                : below
                  ? `Leading the country by ${fmtScore(me.score - below.score)} over ${below.state}.`
                  : `${myState} is leading.`}{" "}
            <span className="text-muted">
              {me.players} of {formatNumber(me.members)} corpers played this week.
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {quiz.kind === "ready" || quiz.kind === "playing" ? (
              <Link href="/quiz" className="btn-primary h-12 text-[15px]">
                {quiz.kind === "playing" ? "Finish quiz" : "Play today"}
              </Link>
            ) : (
              <span className="flex h-12 items-center justify-center rounded-full bg-surface-2 text-[15px] font-bold text-muted">Played today ✓</span>
            )}
            <Link href="/invite" className="btn-secondary h-12 text-[15px]">
              Invite to {myState.length > 9 ? "your state" : myState}
            </Link>
          </div>
        </section>
      )}

      <p className="-mt-1 px-1 text-[13px] text-faint">
        Every quiz point counts for your state. States are ranked by points per corper, so every member counts and small
        states can win. The winning state&apos;s players (3+ days) get the Champion State badge; the top player gets Quiz MVP.
        {last?.winner_state && ` Last week: ${last.winner_state} won.`}
      </p>

      <section className="flex flex-col gap-3" aria-label="States">
        <h2 className="h-display text-xl">States</h2>
        {ranked.length === 0 ? (
          <p className="card text-[15px] text-muted">No state has {MIN_MEMBERS} corpers yet.</p>
        ) : (
          <ol className="card flex flex-col !p-0">
            {ranked.map((s) => (
              <li
                key={s.state}
                className={`flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 ${s.state === myState ? "bg-surface-2" : ""}`}
              >
                <span className={`w-6 shrink-0 text-center text-sm font-bold tabular-nums ${s.rank === 1 ? "text-lime-ink" : "text-muted"}`}>
                  {s.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">
                    {s.state}
                    {s.rank === 1 && s.points > 0 && " 🏆"}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {s.players} of {formatNumber(s.members)} played
                  </span>
                </span>
                <span className="shrink-0 text-[15px] font-bold tabular-nums">{fmtScore(s.score)}</span>
              </li>
            ))}
          </ol>
        )}
        {unranked.length > 0 && (
          <p className="px-1 text-[13px] text-faint">
            Not ranked yet (under {MIN_MEMBERS} corpers): {unranked.map((s) => `${s.state} ${s.members}`).join(" · ")}
          </p>
        )}
      </section>

      <Players title="Top players in Nigeria" rows={national} me={user.id} myRow={mine && { rank: mine.national, points: mine.points }} />
      {myState && <Players title={`Top in ${myState}`} rows={local} me={user.id} myRow={mine && { rank: mine.in_state, points: mine.points }} />}
    </>
  );
}
