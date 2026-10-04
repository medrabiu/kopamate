"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { continueQuiz, submitAnswer } from "@/app/actions/quiz";
import { useStreak } from "@/components/Streak";
import { useToast } from "@/components/Toast";
import type { Answered, QuizQuestion, QuizResult as Result } from "@/lib/quiz";
import type { Mark } from "@/lib/quiz-meta";
import QuizResult from "./QuizResult";

type Props = {
  /** Already started today: skip the intro and pick up the open question. */
  resume: boolean;
  state: string;
  seconds: number;
  questions: number;
  link: string;
  nextAt: string;
  /** Swaps the server calls, for the dev-only preview. */
  api?: { continueQuiz: typeof continueQuiz; submitAnswer: typeof submitAnswer };
};

const serverApi = { continueQuiz, submitAnswer };

type Reveal = NonNullable<Answered["feedback"]> & { chosen: number | null };

/** How long the picked answer shows on the front before the card flips. */
const FLIP_DELAY_MS = 650;
/** After flipping, the back moves on by itself after this long (or sooner with Next). */
const AUTO_NEXT_MS = 4500;
/** Each beat of the 3-2-1 before the first question. The server's clock hasn't started yet. */
const COUNT_MS = 650;
const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** A short buzz on phones that support it. */
function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

/**
 * Plays the Daily Quiz as a deck of flip cards. The server keeps the real clock; this one only draws the
 * ring and sends a "time's up" when it runs out. After an answer the card flips to show the right answer
 * and a fact; the next question is fetched when the player moves on, so its time starts then.
 */
export default function QuizPlayer({ resume, state, seconds, questions, link, nextAt, api = serverApi }: Props) {
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [msLeft, setMsLeft] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  // Marks for the questions answered on this screen; earlier ones (after a resume) stay unknown.
  const [marks, setMarks] = useState<(Mark | undefined)[]>([]);
  const [inARow, setInARow] = useState(0);
  const [toast, show] = useToast();
  const streak = useStreak();
  const deadline = useRef(0);
  const sent = useRef(false);
  // The finished result, held while the last card's back is showing.
  const pending = useRef<Result | null>(null);
  const moving = useRef(false);

  const load = useCallback(async () => {
    setBusy(true);
    const step = await api.continueQuiz().catch(() => ({ error: "No connection. Try again." }));
    setBusy(false);
    moving.current = false;
    if ("error" in step) return show(step.error);
    setReveal(null);
    setFlipped(false);
    if (step.result) setResult(step.result);
    if (step.question) {
      sent.current = false;
      deadline.current = performance.now() + step.question.msLeft;
      setMsLeft(step.question.msLeft);
      setQuestion(step.question);
    }
  }, [api, show]);

  useEffect(() => {
    if (resume) load();
  }, [resume, load]);

  /** From the back of the card to the next card, or to the score after the last one. */
  const next = useCallback(() => {
    if (moving.current) return;
    moving.current = true;
    if (pending.current) {
      setQuestion(null);
      setReveal(null);
      setResult(pending.current);
    } else load();
  }, [load]);

  const answer = useCallback(
    async (choice: number | null) => {
      if (!question || sent.current) return;
      sent.current = true;
      setBusy(true);
      const res = await api.submitAnswer(question.day, question.idx, choice).catch(() => ({ error: "No connection." }));
      setBusy(false);
      if ("error" in res) {
        // Try the same question again; the server's clock decides if it still counts.
        sent.current = false;
        return show(res.error);
      }
      if (res.streak) streak?.apply(res.streak);
      pending.current = res.result;
      if (!res.feedback) return next();
      const fb = res.feedback;
      setReveal({ ...fb, chosen: choice });
      setMarks((m) => {
        const copy = [...m];
        copy[fb.idx] = fb.timedOut ? null : fb.correct;
        return copy;
      });
      setInARow((n) => (fb.correct ? n + 1 : 0));
      buzz(fb.correct ? 25 : [40, 60, 40]);
    },
    [api, question, next, show, streak],
  );

  // Flip after the pick has shown on the front, then move on by itself after a while.
  useEffect(() => {
    if (!reveal) return;
    if (!flipped) {
      const t = setTimeout(() => setFlipped(true), FLIP_DELAY_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(next, AUTO_NEXT_MS);
    return () => clearTimeout(t);
  }, [reveal, flipped, next]);

  // 3-2-1, then fetch the first question.
  useEffect(() => {
    if (countdown === null) return;
    const t = setTimeout(() => {
      if (countdown > 1) setCountdown(countdown - 1);
      else {
        setCountdown(null);
        load();
      }
    }, COUNT_MS);
    return () => clearTimeout(t);
  }, [countdown, load]);

  // Answer with 1-4 or A-D on a keyboard.
  useEffect(() => {
    if (!question || reveal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const k = e.key.toUpperCase();
      const i = /^[1-9]$/.test(k) ? Number(k) - 1 : LETTERS.indexOf(k);
      if (i >= 0 && i < question.options.length) answer(i);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question, reveal, answer]);

  // The ring and the "time's up" send.
  useEffect(() => {
    if (!question || reveal) return;
    const t = setInterval(() => {
      const left = Math.max(0, deadline.current - performance.now());
      setMsLeft(left);
      if (left === 0) answer(null);
    }, 100);
    return () => clearInterval(t);
  }, [question, reveal, answer]);

  if (result) return <QuizResult result={result} state={state} link={link} nextAt={nextAt} fresh />;

  if (countdown !== null) {
    return (
      <section className="card flex min-h-[340px] flex-col items-center justify-center gap-2 !p-[22px]" aria-label="Get ready">
        <p className="text-sm text-muted">Get ready</p>
        <p key={countdown} className="quiz-count h-display text-[96px] leading-none text-lime-ink" aria-live="assertive">
          {countdown}
        </p>
      </section>
    );
  }

  if (!question) {
    const rules = [
      ["⏱️", `${questions} questions, ${seconds} seconds each`],
      ["⚡", "Right answers score 100, plus up to 50 for speed"],
      ["🔥", "Your streak adds bonus points"],
      ["🎯", "One try a day. Once you start, the clock runs."],
    ];
    return (
      <section className="card flex flex-col gap-5 !p-[22px]" aria-label="Daily Quiz">
        {toast}
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted">Daily Quiz</p>
          <h2 className="h-display text-[28px] leading-tight">Play for {state}</h2>
        </div>
        <ul className="flex flex-col gap-2.5 text-[15px]">
          {rules.map(([icon, text], i) => (
            <li key={text} className="quiz-rise flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3" style={{ animationDelay: `${i * 70}ms` }}>
              <span className="text-xl" aria-hidden="true">
                {icon}
              </span>
              {text}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => (resume ? load() : setCountdown(3))}
          disabled={busy}
          className="btn-primary"
        >
          {busy ? "Loading…" : "Start"}
        </button>
      </section>
    );
  }

  const secondsLeft = Math.ceil(msLeft / 1000);
  const low = !reveal && secondsLeft <= 5;
  const frac = reveal ? 0 : msLeft / (seconds * 1000);
  const RING = 2 * Math.PI * 20;
  const left = question.total - question.idx - 1;
  const last = question.idx + 1 >= question.total;
  return (
    <section className="flex flex-col gap-4" aria-label={`Question ${question.idx + 1} of ${question.total}`}>
      {toast}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted">
            Card {question.idx + 1} of {question.total}
          </span>
          <div className="flex gap-1.5" aria-hidden="true">
            {Array.from({ length: question.total }, (_, i) => {
              const m = marks[i];
              const current = i === question.idx && !reveal;
              return (
                <span
                  key={i}
                  className={`h-2 w-6 rounded-full transition-colors duration-300 ${
                    m === true
                      ? "bg-lime"
                      : m === false
                        ? "bg-pink"
                        : m === null
                          ? "bg-muted"
                          : i < question.idx
                            ? "bg-ink/40"
                            : current
                              ? "quiz-pulse bg-ink"
                              : "bg-surface-2"
                  }`}
                />
              );
            })}
          </div>
        </div>
        <div className={`relative grid size-12 shrink-0 place-items-center ${low ? "quiz-pulse" : ""}`} aria-live="off">
          <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="24" cy="24" r="20" fill="none" strokeWidth="4" className="stroke-surface-2" />
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - frac)}
              className={`transition-[stroke-dashoffset] duration-100 ease-linear ${low ? "stroke-pink" : "stroke-lime"}`}
            />
          </svg>
          <span className={`text-[15px] font-bold tabular-nums ${low ? "text-pink-ink" : "text-ink"}`}>
            {reveal ? (reveal.correct ? "✓" : "✕") : secondsLeft}
          </span>
        </div>
      </div>

      {/* The deck: the cards still to come peek out underneath. */}
      <div className="relative pb-3">
        {left >= 2 && <div className="absolute inset-x-6 top-4 bottom-0 rounded-3xl border border-line bg-surface-2" aria-hidden="true" />}
        {left >= 1 && <div className="absolute inset-x-3 top-2 bottom-1.5 rounded-3xl border border-line bg-surface" aria-hidden="true" />}
        <div key={question.idx} className="quiz-deal flip-scene relative">
          <div className={`flip-card ${flipped ? "is-flipped" : ""}`}>
            {/* Front: the question */}
            <div className="flip-face card flex flex-col gap-5 bg-surface !p-[22px] shadow-[0_8px_24px_rgb(0_0_0/0.18)]" inert={flipped} aria-hidden={flipped}>
              <span className="w-fit rounded-full bg-surface-2 px-3 py-1 text-xs font-bold tracking-wide text-muted uppercase">
                {question.category}
              </span>
              <h2 className="h-display text-[22px] leading-snug">{question.text}</h2>
              <div className="flex flex-col gap-2.5">
                {question.options.map((o, i) => {
                  const right = reveal && i === reveal.rightChoice;
                  const wrongPick = reveal && i === reveal.chosen && !reveal.correct;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => answer(i)}
                      disabled={busy || Boolean(reveal)}
                      style={{ animationDelay: right || wrongPick ? "0ms" : `${120 + i * 60}ms` }}
                      className={`quiz-rise group flex min-h-13 items-center gap-3 rounded-2xl border px-3 py-3 text-left text-[16px] font-medium transition-[background-color,border-color,opacity,transform] duration-200 active:scale-[0.98] ${
                        right
                          ? "quiz-pop border-lime bg-lime text-on-accent"
                          : wrongPick
                            ? "quiz-shake border-pink bg-pink text-on-accent"
                            : reveal
                              ? "border-line opacity-40"
                              : "border-line hover:border-ink/30 hover:bg-surface-2 active:bg-surface-2"
                      }`}
                    >
                      <span
                        className={`grid size-8 shrink-0 place-items-center rounded-xl text-sm font-bold transition-colors ${
                          right || wrongPick ? "bg-on-accent/15" : "bg-surface-2 group-hover:bg-line"
                        }`}
                        aria-hidden="true"
                      >
                        {right ? "✓" : wrongPick ? "✕" : LETTERS[i]}
                      </span>
                      <span className="flex-1">{o}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Back: how it went */}
            <div
              className={`flip-face flip-back card flex flex-col items-center justify-center gap-4 !p-[22px] text-center ${
                reveal?.correct ? "border-lime bg-lime text-on-accent" : "border-pink bg-pink text-on-accent"
              }`}
              inert={!flipped}
              aria-hidden={!flipped}
              aria-live="polite"
            >
              {reveal && (
                <>
                  <span className="grid size-16 place-items-center rounded-full bg-on-accent/15 text-[32px] font-bold" aria-hidden="true">
                    {reveal.correct ? "✓" : reveal.timedOut ? "⏰" : "✕"}
                  </span>
                  <div>
                    <p className="h-display text-[28px] leading-tight">
                      {reveal.correct ? "Correct!" : reveal.timedOut ? "Time's up" : "Not quite"}
                    </p>
                    {reveal.correct ? (
                      <p className={`${flipped ? "quiz-float" : ""} mt-1 text-[17px] font-bold`}>
                        +{reveal.points} pts{inARow >= 2 && ` · 🔥 ${inARow} in a row`}
                      </p>
                    ) : (
                      <p className="mt-1 text-[15px] font-medium opacity-80">No points this time</p>
                    )}
                  </div>
                  {!reveal.correct && (
                    <p className="text-[15px]">
                      Answer: <span className="font-bold">{question.options[reveal.rightChoice]}</span>
                    </p>
                  )}
                  {reveal.fact && (
                    <p className="rounded-2xl bg-on-accent/10 px-4 py-3 text-left text-[15px] leading-snug">
                      <span className="font-bold">💡 Did you know? </span>
                      {reveal.fact}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={next}
                    disabled={busy}
                    className="relative mt-1 flex h-12 w-full items-center justify-center overflow-hidden rounded-full bg-on-accent font-bold text-lime"
                  >
                    {flipped && (
                      <span
                        className="quiz-drain absolute inset-0 origin-left bg-white/10"
                        style={{ animationDuration: `${AUTO_NEXT_MS}ms` }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="relative">{busy ? "Loading…" : last ? "See my score" : "Next card →"}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
