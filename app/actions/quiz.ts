"use server";

import { revalidateTag } from "next/cache";
import { checkAutoBadges } from "@/lib/badges";
import { transaction } from "@/lib/db";
import { answerQuestion, startQuiz, type Answered, type Step } from "@/lib/quiz";
import { getCurrentUser } from "@/lib/session";
import { track } from "@/lib/stats";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Starts today's quiz, or continues it: returns the open question (serving the next one), or the result. */
export async function continueQuiz(): Promise<Step | { error: string }> {
  const user = await getCurrentUser();
  if (!user?.completed_at || !user.state) return { error: "Log in to play." };
  const step = await transaction((tx) => startQuiz(tx, user.id, user.state!));
  if (step.question?.idx === 0 && step.question.msLeft > 14_000) await track("quiz_started", user.id);
  if (!step.question && !step.result) return { error: "Today's quiz isn't ready yet. Check back soon." };
  return step;
}

/** Answers one question (`choice` null when time ran out). */
export async function submitAnswer(day: string, idx: number, choice: number | null): Promise<Answered | { error: string }> {
  const user = await getCurrentUser();
  if (!user?.completed_at) return { error: "Log in to play." };
  if (!DAY.test(day) || !Number.isInteger(idx) || idx < 0 || idx > 20) return { error: "That question is gone." };
  if (choice !== null && (!Number.isInteger(choice) || choice < 0 || choice > 3)) return { error: "Pick an answer." };

  const step = await transaction((tx) => answerQuestion(tx, user.id, day, idx, choice));
  if (step.result && step.feedback) {
    // Just finished: the League table moves, and a streak milestone may earn a badge.
    revalidateTag("league");
    await track("quiz_finished", user.id, { points: step.result.points + step.result.bonus, correct: step.result.correct });
    if (step.streak?.milestone) await checkAutoBadges(user.id);
  }
  return step;
}
