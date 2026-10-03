"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { continueQuiz, submitAnswer } from "@/app/actions/quiz";
import { useStreak } from "@/components/Streak";
import { useToast } from "@/components/Toast";
import type { Answered, QuizQuestion, QuizResult as Result } from "@/lib/quiz";
import QuizResult from "./QuizResult";

type Props = {
  /** Already started today: skip the intro and pick up the open question. */
  resume: boolean;
  state: string;
  seconds: number;
  questions: number;
  link: string;
  nextAt: string;
};

type Reveal = NonNullable<Answered["feedback"]> & { chosen: number | null };

/** How long the right answer stays on screen before the next question loads. */
const REVEAL_MS = 1400;

/**
 * Plays the Daily Quiz. The server keeps the real clock; this one only draws the bar and sends a
 * "time's up" when it runs out. The next question is fetched after the reveal so its time starts then.
 */
export default function QuizPlayer({ resume, state, seconds, questions, link, nextAt }: Props) {
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [msLeft, setMsLeft] = useState(0);
  const [toast, show] = useToast();
  const streak = useStreak();
  const deadline = useRef(0);
  const sent = useRef(false);

  const load = useCallback(async () => {
    setBusy(true);
    const step = await continueQuiz().catch(() => ({ error: "No connection. Try again." }));
    setBusy(false);
    if ("error" in step) return show(step.error);
    setReveal(null);
    if (step.result) setResult(step.result);
    if (step.question) {
      sent.current = false;
      deadline.current = performance.now() + step.question.msLeft;
      setMsLeft(step.question.msLeft);
      setQuestion(step.question);
    }
  }, [show]);

  useEffect(() => {
    if (resume) load();
  }, [resume, load]);

  const answer = useCallback(
    async (choice: number | null) => {
      if (!question || sent.current) return;
      sent.current = true;
      setBusy(true);
      const res = await submitAnswer(question.day, question.idx, choice).catch(() => ({ error: "No connection." }));
      setBusy(false);
      if ("error" in res) {
        // Try the same question again; the server's clock decides if it still counts.
        sent.current = false;
        return show(res.error);
      }
      if (res.streak) streak?.apply(res.streak);
      if (res.feedback) setReveal({ ...res.feedback, chosen: choice });
      setTimeout(() => {
        if (res.result) {
          setQuestion(null);
          setReveal(null);
          setResult(res.result);
        } else load();
      }, res.feedback ? REVEAL_MS : 0);
    },
    [question, load, show, streak],
  );

  // The bar and the "time's up" send.
  useEffect(() => {
    if (!question || reveal) return;
    const t = setInterval(() => {
      const left = Math.max(0, deadline.current - performance.now());
      setMsLeft(left);
      if (left === 0) answer(null);
    }, 100);
    return () => clearInterval(t);
  }, [question, reveal, answer]);

  if (result) return <QuizResult result={result} state={state} link={link} nextAt={nextAt} />;

  if (!question) {
    return (
      <section className="card flex flex-col gap-5 !p-[22px]" aria-label="Daily Quiz">
        {toast}
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted">Daily Quiz</p>
          <h2 className="h-display text-[28px] leading-tight">Play for {state}</h2>
        </div>
        <ul className="flex flex-col gap-2.5 text-[15px]">
          <li>⏱️ {questions} questions, {seconds} seconds each</li>
          <li>⚡ Right answers score 100, plus up to 50 for speed</li>
          <li>🔥 Your streak adds bonus points</li>
          <li>🎯 One try a day. Once you start, the clock runs.</li>
        </ul>
        <button type="button" onClick={load} disabled={busy} className="btn-primary">
          {busy ? "Loading…" : "Start"}
        </button>
      </section>
    );
  }

  const secondsLeft = Math.ceil(msLeft / 1000);
  const low = !reveal && secondsLeft <= 5;
  return (
    <section className="card flex flex-col gap-5 !p-[22px]" aria-label={`Question ${question.idx + 1} of ${question.total}`}>
      {toast}
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted">
          {question.idx + 1} of {question.total} · {question.category}
        </span>
        <span className={`font-bold tabular-nums ${low ? "text-pink-ink" : "text-ink"}`} aria-live="off">
          {reveal ? "" : `${secondsLeft}s`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2" aria-hidden="true">
        <div
          className={`h-1.5 rounded-full ${low ? "bg-pink" : "bg-lime"}`}
          style={{ width: `${reveal ? 0 : (msLeft / (seconds * 1000)) * 100}%` }}
        />
      </div>
      <h2 key={question.idx} className="page-enter h-display text-[22px] leading-snug">
        {question.text}
      </h2>
      <div className="flex flex-col gap-2.5">
        {question.options.map((o, i) => {
          const right = reveal && i === reveal.rightChoice;
          const wrongPick = reveal && i === reveal.chosen && !reveal.correct;
          return (
            <button
              key={`${question.idx}-${i}`}
              type="button"
              onClick={() => answer(i)}
              disabled={busy || Boolean(reveal)}
              className={`min-h-13 rounded-2xl border px-4 py-3 text-left text-[16px] font-medium transition-colors ${
                right
                  ? "border-lime bg-lime text-on-accent"
                  : wrongPick
                    ? "border-pink bg-pink text-on-accent"
                    : reveal
                      ? "border-line opacity-50"
                      : "border-line hover:bg-surface-2 active:bg-surface-2"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
      <p className="h-6 text-center text-[15px] font-bold" aria-live="polite">
        {reveal &&
          (reveal.correct ? (
            <span className="text-lime-ink">Correct · +{reveal.points}</span>
          ) : reveal.timedOut ? (
            <span className="text-pink-ink">Time&apos;s up</span>
          ) : (
            <span className="text-pink-ink">Not quite</span>
          ))}
      </p>
    </section>
  );
}
