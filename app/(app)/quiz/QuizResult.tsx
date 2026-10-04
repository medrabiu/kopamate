"use client";

import Link from "next/link";
import Confetti from "@/components/Confetti";
import CountUp from "@/components/CountUp";
import Countdown from "@/components/Countdown";
import { logShare } from "@/components/ShareButtons";
import { ChatIcon } from "@/components/icons";
import type { QuizResult as Result } from "@/lib/quiz";
import { markEmoji } from "@/lib/quiz-meta";

const shortDay = (day: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

/** The WhatsApp brag: squares, points and the state, with the invite link. No answers are given away. */
function shareText(r: Result, state: string, link: string) {
  return [
    `Kopamate Daily Quiz · ${shortDay(r.day)}`,
    `${r.marks.map(markEmoji).join("")} ${r.correct}/${r.total} · ${r.points + r.bonus} pts`,
    `Playing for ${state} 🇳🇬 Can you beat me? ${link}`,
  ].join("\n");
}

/** A line to go with the score. */
function headline(correct: number, total: number) {
  if (correct === total) return "Perfect score! 🏆";
  if (correct / total >= 0.6) return "Solid run 💪";
  if (correct > 0) return "Good effort 👏";
  return "Tough one today 😅";
}

/**
 * Score after the quiz: squares, points with the streak bonus, share, and when the next quiz opens.
 * `fresh` is set straight after playing, to animate the score and celebrate a good run.
 */
export default function QuizResult({
  result,
  state,
  link,
  nextAt,
  fresh = false,
}: {
  result: Result;
  state: string;
  link: string;
  nextAt: string;
  fresh?: boolean;
}) {
  const share = `https://wa.me/?text=${encodeURIComponent(shareText(result, state, link))}`;
  const total = result.points + result.bonus;
  return (
    <section className="card flex flex-col items-center gap-4 !p-[22px] text-center" aria-label="Your score today">
      <Confetti fire={fresh && result.correct / result.total >= 0.6} />
      <div>
        <p className="text-sm text-muted">Today&apos;s score</p>
        <p className={`${fresh ? "quiz-rise" : ""} h-display mt-1 text-[22px]`}>{headline(result.correct, result.total)}</p>
      </div>
      <p className="flex gap-1.5 text-[32px] leading-none" aria-label={`${result.correct} of ${result.total} right`}>
        {result.marks.map((m, i) => (
          <span key={i} className={fresh ? "quiz-count" : ""} style={{ animationDelay: `${150 + i * 120}ms` }} aria-hidden="true">
            {markEmoji(m)}
          </span>
        ))}
      </p>
      <div>
        <p className="h-display text-[48px] leading-none text-lime-ink">{fresh ? <CountUp to={total} duration={1200} /> : total}</p>
        <p className="mt-1 text-sm text-muted">
          points for {state}
          {result.bonus > 0 && ` · includes +${result.bonus} streak bonus`}
        </p>
      </div>
      <a href={share} target="_blank" rel="noopener" onClick={() => logShare("whatsapp_quiz")} className="btn-primary h-12 gap-1.5 text-[15px]">
        <ChatIcon size={18} />
        Share your score
      </a>
      <Link href="/league" className="btn-secondary h-12 text-[15px]">
        See the State League
      </Link>
      <p className="text-sm text-muted">
        Next quiz in <Countdown to={nextAt} className="font-bold text-ink" />
      </p>
    </section>
  );
}
