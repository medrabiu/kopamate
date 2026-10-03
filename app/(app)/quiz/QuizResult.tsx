"use client";

import Link from "next/link";
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

/** Score after the quiz: squares, points with the streak bonus, share, and when the next quiz opens. */
export default function QuizResult({ result, state, link, nextAt }: { result: Result; state: string; link: string; nextAt: string }) {
  const share = `https://wa.me/?text=${encodeURIComponent(shareText(result, state, link))}`;
  return (
    <section className="card flex flex-col items-center gap-4 !p-[22px] text-center" aria-label="Your score today">
      <p className="text-sm text-muted">Today&apos;s score</p>
      <p className="text-[32px] leading-none tracking-[0.2em]" aria-label={`${result.correct} of ${result.total} right`}>
        {result.marks.map(markEmoji).join("")}
      </p>
      <div>
        <p className="h-display text-[48px] leading-none text-lime-ink">{result.points + result.bonus}</p>
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
