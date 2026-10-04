import Link from "next/link";
import Countdown from "@/components/Countdown";
import { ChevronRight } from "@/components/icons";
import { MIN_MEMBERS, type StateStanding } from "@/lib/league";
import { QUESTIONS_PER_DAY, SECONDS_PER_QUESTION, type QuizStatus } from "@/lib/quiz";
import type { Streak } from "@/lib/streaks";
import { markEmoji } from "@/lib/quiz-meta";

const fmt = (n: number) => n.toFixed(1);

/**
 * Home's main card: today's quiz (play, finish, or your score) and where your state stands this week.
 * The state line is the hook: your points visibly move your state.
 */
export default function QuizCard({
  status,
  streak,
  state,
  standing,
  above,
  nextAt,
  scores = true,
}: {
  status: QuizStatus;
  streak: Streak;
  state: string;
  standing: StateStanding | undefined;
  above: StateStanding | undefined;
  nextAt: string;
  /** Counts in the State League (serving or posted). Others play for their streak only. */
  scores?: boolean;
}) {
  const atRisk = streak.days > 0 && !streak.today;
  return (
    <section className="card flex flex-col gap-4 !p-[22px]" aria-labelledby="quiz-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="quiz-title" className="text-sm text-muted">
          Daily Quiz
        </h2>
        {status.kind !== "done" && (
          <span className="text-[13px] text-muted">
            {QUESTIONS_PER_DAY} questions · {SECONDS_PER_QUESTION}s each
          </span>
        )}
      </div>

      {status.kind === "done" ? (
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[26px] leading-none tracking-[0.15em]">{status.result.marks.map(markEmoji).join("")}</p>
            <p className="mt-2 text-sm text-muted">
              <span className="h-display text-xl text-lime-ink">{status.result.points + status.result.bonus}</span> pts{scores ? ` for ${state}` : " today"}
            </p>
          </div>
          <p className="text-right text-[13px] text-muted">
            Next quiz in
            <br />
            <Countdown to={nextAt} className="font-bold text-ink" />
          </p>
        </div>
      ) : status.kind === "unavailable" ? (
        <p className="text-[15px]">Today&apos;s quiz isn&apos;t ready yet. Check back soon.</p>
      ) : (
        <>
          <p className="h-display text-[26px] leading-tight">
            {status.kind === "playing" ? "Finish today's quiz" : scores ? `Play for ${state}` : "Play today's quiz"}
          </p>
          {atRisk && (
            <p className="-mt-2 text-[13px] font-bold text-pink-ink">
              {streak.covering > 0
                ? `You missed a day. Play today and a freeze keeps your ${streak.days}-day streak.`
                : `Play today to keep your ${streak.days}-day streak`}
            </p>
          )}
          <Link href="/quiz" className="btn-primary">
            {status.kind === "playing" ? "Continue" : "Play now"}
          </Link>
        </>
      )}

      {scores && standing && (
        <Link href="/league" className="-mb-1 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
          <span className="min-w-0">
            {standing.rank ? (
              <>
                <span className="font-bold text-lime-ink">
                  {state} #{standing.rank}
                </span>
                <span className="text-muted">
                  {above
                    ? ` · ${fmt(above.score - standing.score)} behind ${above.state}`
                    : standing.points > 0
                      ? " · leading Nigeria this week"
                      : " this week"}
                </span>
              </>
            ) : (
              <span className="text-muted">
                {state} needs {MIN_MEMBERS} corpers to be ranked · {standing.members} now
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center font-bold text-lime-ink">
            League
            <ChevronRight size={16} />
          </span>
        </Link>
      )}
    </section>
  );
}
