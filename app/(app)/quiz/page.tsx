import type { Metadata } from "next";
import Link from "next/link";
import { StreakChip, StreakProvider } from "@/components/Streak";
import { ChevronLeft } from "@/components/icons";
import { referralLink } from "@/lib/config";
import { getQuizStatus, QUESTIONS_PER_DAY, SECONDS_PER_QUESTION } from "@/lib/quiz";
import { requireUser } from "@/lib/session";
import { getStreak } from "@/lib/streaks";
import { nextLagosMidnight } from "@/lib/util";
import QuizPlayer from "./QuizPlayer";
import QuizResult from "./QuizResult";

export const metadata: Metadata = { title: "Daily Quiz" };

export default async function QuizPage() {
  const user = await requireUser();
  const [status, streak] = await Promise.all([getQuizStatus(user.id), getStreak(user.id)]);
  const state = user.state ?? "your state";
  const link = referralLink(user.referral_code);
  const nextAt = nextLagosMidnight();

  return (
    <StreakProvider initial={streak}>
      <header className="flex h-11 items-center justify-between">
        <Link href="/home" className="-ml-2 flex items-center gap-1 py-2 pr-2 text-[15px] font-bold" aria-label="Back to Home">
          <ChevronLeft size={20} />
          Daily Quiz
        </Link>
        <StreakChip />
      </header>

      {status.kind === "unavailable" && (
        <section className="card text-[15px]">Today&apos;s quiz isn&apos;t ready yet. Check back soon.</section>
      )}
      {status.kind === "done" && (
        <QuizResult result={status.result} state={state} link={link} nextAt={nextAt} />
      )}
      {(status.kind === "ready" || status.kind === "playing") && (
        <QuizPlayer
          resume={status.kind === "playing"}
          state={state}
          seconds={SECONDS_PER_QUESTION}
          questions={QUESTIONS_PER_DAY}
          link={link}
          nextAt={nextAt}
        />
      )}
    </StreakProvider>
  );
}
