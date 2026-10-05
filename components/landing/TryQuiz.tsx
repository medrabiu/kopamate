"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Confetti from "../Confetti";
import { markEmoji, type Mark } from "@/lib/quiz-meta";

/** Three real questions from the Daily Quiz bank (scripts/quiz-bank.mjs), answers already shuffled. */
const QUESTIONS = [
  {
    text: "In orientation camp, corpers are split into groups called what?",
    options: ["Squads", "Houses", "Platoons", "Battalions"],
    right: 2,
    fact: "Platoons compete against each other in drills, sports and the cultural night.",
  },
  {
    text: "What wakes corpers up early every morning in camp?",
    options: ["The bugle", "A church bell", "The camp radio", "An alarm clock"],
    right: 0,
    fact: "Morning activities often start before 5am, so the bugle is famous among corpers.",
  },
  {
    text: "Which letter tells a prospective corper where they'll serve?",
    options: ["Posting letter", "Release letter", "Acceptance letter", "Call-up letter"],
    right: 3,
    fact: "It's printed from the NYSC portal and shows your orientation camp state.",
  },
];

const SECONDS = 15;
const LETTERS = ["A", "B", "C", "D"];

/** Same scoring as the real quiz: 100 for a right answer, up to 50 more for speed. */
const scoreFor = (ms: number) => 100 + Math.round(50 * Math.max(0, 1 - ms / (SECONDS * 1000)));

/** Landing: a playable three-question taste of the Daily Quiz, with the same flip cards. */
export default function TryQuiz() {
  const [idx, setIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [gained, setGained] = useState(0);
  const [points, setPoints] = useState(0);
  const [marks, setMarks] = useState<Mark[]>([]);
  const shownAt = useRef(0);
  const done = marks.length === QUESTIONS.length && flipped === false && idx === QUESTIONS.length;
  const q = QUESTIONS[Math.min(idx, QUESTIONS.length - 1)];
  const answered = marks.length > idx;

  // The clock runs only while a question is on screen and unanswered.
  useEffect(() => {
    if (!started || answered || idx >= QUESTIONS.length) return;
    shownAt.current = performance.now();
    const t = setTimeout(() => pick(null), SECONDS * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, idx, answered]);

  function pick(choice: number | null) {
    if (answered) return;
    const correct = choice === q.right;
    const got = correct ? scoreFor(performance.now() - shownAt.current) : 0;
    setChosen(choice);
    setGained(got);
    setPoints((p) => p + got);
    setMarks((m) => [...m, choice === null ? null : correct]);
    setTimeout(() => setFlipped(true), 650);
  }

  function next() {
    setFlipped(false);
    setChosen(null);
    setIdx((i) => i + 1);
  }

  function restart() {
    setIdx(0);
    setMarks([]);
    setPoints(0);
    setChosen(null);
    setFlipped(false);
    setStarted(true);
  }

  const correct = chosen === q.right;
  const timedOut = answered && chosen === null;
  const allRight = done && marks.every((m) => m === true);

  if (!started) {
    return (
      <div className="card flex flex-col items-center gap-4 bg-surface !p-8 text-center">
        <span className="text-[44px] leading-none" aria-hidden="true">
          🎯
        </span>
        <div>
          <p className="h-display text-[22px]">3 questions. {SECONDS} seconds each.</p>
          <p className="mt-1 text-muted">The real Daily Quiz has 5 new ones every day, and every point counts for your state.</p>
        </div>
        <button type="button" onClick={() => setStarted(true)} className="btn-primary h-13 sm:w-auto sm:px-10">
          Start
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card quiz-deal flex flex-col items-center gap-4 bg-surface !p-8 text-center">
        <Confetti fire={allRight} />
        <p className="text-[32px] tracking-[0.2em]" aria-label={`${marks.filter((m) => m).length} of ${marks.length} right`}>
          {marks.map(markEmoji).join("")}
        </p>
        <div>
          <p className="h-display text-[34px] leading-none text-lime-ink">{points} pts</p>
          <p className="mt-2 text-muted">
            {allRight ? "All three. Your state needs you on the leaderboard." : "Not bad. Play every day and it adds up for your state."}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
          <Link href="/join" className="btn-primary h-13 sm:w-auto sm:px-8">
            Play today&apos;s quiz
          </Link>
          <button type="button" onClick={restart} className="btn-secondary h-13 sm:w-auto sm:px-6">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold">
          Question {idx + 1} <span className="font-normal text-muted">of {QUESTIONS.length}</span>
        </span>
        <span className="h-display text-lime-ink tabular-nums">{points} pts</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        {!answered && <div key={idx} className="quiz-drain h-full origin-left rounded-full bg-lime" style={{ animationDuration: `${SECONDS}s` }} />}
      </div>

      <div className="flip-scene">
        <div key={idx} className={`flip-card quiz-deal ${flipped ? "is-flipped" : ""}`}>
          <div className="flip-face card flex flex-col gap-5 bg-surface !p-[22px] shadow-[0_8px_24px_rgb(0_0_0/0.18)]" inert={flipped} aria-hidden={flipped}>
            <span className="w-fit rounded-full bg-surface-2 px-3 py-1 text-xs font-bold tracking-wide text-muted uppercase">NYSC</span>
            <h3 className="h-display text-[21px] leading-snug">{q.text}</h3>
            <div className="flex flex-col gap-2.5">
              {q.options.map((o, i) => {
                const right = answered && i === q.right;
                const wrongPick = answered && i === chosen && !correct;
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => pick(i)}
                    disabled={answered}
                    style={{ animationDelay: answered ? "0ms" : `${120 + i * 60}ms` }}
                    className={`quiz-rise group flex min-h-13 items-center gap-3 rounded-2xl border px-3 py-3 text-left text-[16px] font-medium transition-[background-color,border-color,opacity,transform] duration-200 active:scale-[0.98] ${
                      right
                        ? "quiz-pop border-lime bg-lime text-on-accent"
                        : wrongPick
                          ? "quiz-shake border-pink bg-pink text-on-accent"
                          : answered
                            ? "border-line opacity-40"
                            : "border-line hover:border-ink/30 hover:bg-surface-2"
                    }`}
                  >
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-xl text-sm font-bold ${right || wrongPick ? "bg-on-accent/15" : "bg-surface-2 group-hover:bg-line"}`}
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

          <div
            className={`flip-face flip-back card flex flex-col items-center justify-center gap-4 !p-[22px] text-center text-on-accent ${
              correct ? "border-lime bg-lime" : "border-pink bg-pink"
            }`}
            inert={!flipped}
            aria-hidden={!flipped}
            aria-live="polite"
          >
            <span className="grid size-16 place-items-center rounded-full bg-on-accent/15 text-[32px] font-bold" aria-hidden="true">
              {correct ? "✓" : timedOut ? "⏰" : "✕"}
            </span>
            <div>
              <p className="h-display text-[26px]">{correct ? `+${gained} pts` : timedOut ? "Time's up" : "Not this time"}</p>
              {!correct && <p className="mt-1 font-bold">It&apos;s {q.options[q.right]}.</p>}
            </div>
            <p className="max-w-[26rem] leading-relaxed opacity-85">{q.fact}</p>
            <button type="button" onClick={next} className="h-12 rounded-full bg-on-accent px-8 font-bold text-lime">
              {idx + 1 < QUESTIONS.length ? "Next question" : "See your score"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
