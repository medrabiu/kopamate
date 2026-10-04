import "server-only";
import { randomInt } from "node:crypto";
import type postgres from "postgres";
import { sql } from "./db";
import { bumpStreak, type Bump } from "./streaks";
import { lagosDate } from "./util";

/**
 * Daily Quiz. Everyone in Nigeria gets the same QUESTIONS_PER_DAY questions each Lagos day, one attempt,
 * each from a different category (football, music, movies, fashion, tech, Nigeria...).
 * Built to be fair when people compete:
 * - The server keeps the clock. A question's time starts when it is served; refreshing doesn't reset it,
 *   and an answer after the limit (plus a little network slack) scores nothing.
 * - Each player sees the options in their own order, so "the answer is B" is useless to friends.
 * - The right answer never reaches the browser until the question is answered.
 * Points: BASE_POINTS for a right answer plus up to SPEED_POINTS for answering fast, and a streak bonus
 * when the quiz is finished. Points count for the player's state in the State League (lib/league.ts).
 */
export const QUESTIONS_PER_DAY = 5;
export const SECONDS_PER_QUESTION = 15;
const LIMIT_MS = SECONDS_PER_QUESTION * 1000;
/** Slack for slow networks before an answer counts as too late. */
const GRACE_MS = 2500;
/**
 * The server's clock includes the trip down to the phone and back, which is 1–3s on weak 2G/3G.
 * The speed bonus ignores this much of it, so a corper on slow data isn't scored as a slow reader.
 */
const NETWORK_ALLOWANCE_MS = 1500;
export const BASE_POINTS = 100;
export const SPEED_POINTS = 50;
/** Finishing adds STREAK_BONUS_PER_DAY for each streak day, up to STREAK_BONUS_MAX_DAYS. */
export const STREAK_BONUS_PER_DAY = 5;
export const STREAK_BONUS_MAX_DAYS = 10;

type Db = postgres.Sql | postgres.ReservedSql;

export type QuizQuestion = {
  day: string;
  idx: number;
  total: number;
  category: string;
  text: string;
  /** In this player's order. */
  options: string[];
  /** Time left on the server's clock when this was sent. */
  msLeft: number;
};

export type { Mark } from "./quiz-meta";
import type { Mark } from "./quiz-meta";

export type QuizResult = { day: string; points: number; bonus: number; correct: number; total: number; marks: Mark[] };

export type QuizStatus =
  | { kind: "unavailable" }
  | { kind: "ready" }
  | { kind: "playing"; answered: number }
  | { kind: "done"; result: QuizResult };

export type Step = { question: QuizQuestion | null; result: QuizResult | null; streak: Bump | null };

/**
 * Today's questions, picked the first time anyone asks. Each comes from a different category (chosen at
 * random), so every day mixes football, music, fashion, Nigeria and so on; within a category, never-used
 * questions go first, then the longest unused. Ordered easy to hard.
 */
async function dayQuestionIds(db: Db, day: string): Promise<number[] | null> {
  const [have] = await db<{ question_ids: number[] }[]>`SELECT question_ids FROM quiz_days WHERE day = ${day}::date`;
  if (have) return have.question_ids;
  // The freshest few questions of every category, so a category short of fresh ones still gets a turn.
  const candidates = await db<{ id: number; difficulty: number; category: string }[]>`
    SELECT id, difficulty, category FROM (
      SELECT id, difficulty, category,
             row_number() OVER (PARTITION BY category ORDER BY last_used_on NULLS FIRST, random()) AS n
      FROM quiz_questions WHERE active
    ) q WHERE n <= ${QUESTIONS_PER_DAY}
  `;
  type Candidate = (typeof candidates)[number];
  const byCategory = new Map<string, Candidate[]>();
  for (const c of candidates) byCategory.set(c.category, [...(byCategory.get(c.category) ?? []), c]);
  const categories = [...byCategory.keys()];
  for (let i = categories.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [categories[i], categories[j]] = [categories[j], categories[i]];
  }
  // One per category; with fewer categories than questions, go round again.
  const picked: Candidate[] = [];
  for (let round = 0; picked.length < QUESTIONS_PER_DAY && round < QUESTIONS_PER_DAY; round++) {
    for (const c of categories) {
      const q = byCategory.get(c)![round];
      if (q && picked.length < QUESTIONS_PER_DAY) picked.push(q);
    }
  }
  if (picked.length < QUESTIONS_PER_DAY) return null;
  const ids = picked.sort((a, b) => a.difficulty - b.difficulty).map((q) => q.id);
  // Two players starting at once: the first insert wins and both use it.
  await db`INSERT INTO quiz_days (day, question_ids) VALUES (${day}::date, ${ids}::int[]) ON CONFLICT DO NOTHING`;
  const [saved] = await db<{ question_ids: number[] }[]>`SELECT question_ids FROM quiz_days WHERE day = ${day}::date`;
  await db`UPDATE quiz_questions SET last_used_on = ${day}::date WHERE id = ANY(${saved.question_ids}::int[])`;
  return saved.question_ids;
}

/** A random order of the four options (perm[shown position] = stored position; stored 0 is right). */
function shuffledPerm() {
  const p = [0, 1, 2, 3];
  for (let i = p.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

type AnswerRow = { idx: number; question_id: number; perm: number[]; answered: boolean; elapsed_ms: number };

const answerRows = (db: Db, userId: string, day: string) => db<AnswerRow[]>`
  SELECT idx, question_id, perm, (answered_at IS NOT NULL) AS answered,
         (extract(epoch FROM now() - served_at) * 1000)::int AS elapsed_ms
  FROM quiz_answers WHERE user_id = ${userId} AND day = ${day}::date ORDER BY idx
`;

async function questionView(db: Db, day: string, row: Pick<AnswerRow, "idx" | "question_id" | "perm" | "elapsed_ms">): Promise<QuizQuestion> {
  const [q] = await db<{ category: string; question: string; options: string[] }[]>`
    SELECT category, question, options FROM quiz_questions WHERE id = ${row.question_id}
  `;
  return {
    day,
    idx: row.idx,
    total: QUESTIONS_PER_DAY,
    category: q.category,
    text: q.question,
    options: row.perm.map((i) => q.options[i]),
    msLeft: Math.max(0, LIMIT_MS - row.elapsed_ms),
  };
}

/**
 * Moves an attempt along: questions whose time ran out are marked wrong, the open question is returned,
 * or the next one is served. When all are answered the attempt is finished (streak + bonus).
 * Call with the attempt row locked.
 */
async function advance(db: Db, userId: string, day: string): Promise<Step> {
  const rows = await answerRows(db, userId, day);
  for (const r of rows) {
    if (r.answered) continue;
    if (r.elapsed_ms <= LIMIT_MS + GRACE_MS) return { question: await questionView(db, day, r), result: null, streak: null };
    await db`
      UPDATE quiz_answers SET answered_at = served_at + ${LIMIT_MS} * interval '1 millisecond', correct = false, points = 0
      WHERE user_id = ${userId} AND day = ${day}::date AND idx = ${r.idx}
    `;
  }
  if (rows.length < QUESTIONS_PER_DAY) {
    const ids = await dayQuestionIds(db, day);
    if (!ids) return { question: null, result: null, streak: null };
    const perm = shuffledPerm();
    const idx = rows.length;
    await db`
      INSERT INTO quiz_answers (user_id, day, idx, question_id, perm)
      VALUES (${userId}, ${day}::date, ${idx}, ${ids[idx]}, ${perm}::smallint[])
    `;
    return { question: await questionView(db, day, { idx, question_id: ids[idx], perm, elapsed_ms: 0 }), result: null, streak: null };
  }
  return finish(db, userId, day);
}

/** Last question answered: counts the day for the streak, adds the streak bonus and closes the attempt. */
async function finish(db: Db, userId: string, day: string): Promise<Step> {
  const [open] = await db`SELECT 1 FROM quiz_attempts WHERE user_id = ${userId} AND day = ${day}::date AND finished_at IS NULL`;
  let streak: Bump | null = null;
  if (open) {
    // Only today's quiz keeps a streak going; one finished after midnight still scores.
    streak = day === lagosDate() ? await bumpStreak(db, userId) : null;
    const bonus = streak ? Math.min(streak.days, STREAK_BONUS_MAX_DAYS) * STREAK_BONUS_PER_DAY : 0;
    await db`UPDATE quiz_attempts SET bonus = ${bonus}, finished_at = now() WHERE user_id = ${userId} AND day = ${day}::date`;
  }
  return { question: null, result: await getResult(db, userId, day), streak };
}

export async function getResult(db: Db, userId: string, day: string): Promise<QuizResult | null> {
  const [[a], marks] = await Promise.all([
    db<{ points: number; bonus: number; correct: number }[]>`
      SELECT points, bonus, correct FROM quiz_attempts WHERE user_id = ${userId} AND day = ${day}::date
    `,
    db<{ correct: boolean | null; choice: number | null }[]>`
      SELECT correct, choice FROM quiz_answers WHERE user_id = ${userId} AND day = ${day}::date ORDER BY idx
    `,
  ]);
  if (!a) return null;
  return {
    day,
    ...a,
    total: QUESTIONS_PER_DAY,
    marks: Array.from({ length: QUESTIONS_PER_DAY }, (_, i) => {
      const m = marks[i];
      if (!m) return null;
      return m.correct ? true : m.choice === null ? null : false;
    }),
  };
}

/** Where the user is with today's quiz. */
export async function getQuizStatus(userId: string): Promise<QuizStatus> {
  const day = lagosDate();
  const [a] = await sql<{ finished: boolean; answered: number }[]>`
    SELECT (a.finished_at IS NOT NULL) AS finished,
           (SELECT count(*)::int FROM quiz_answers q WHERE q.user_id = a.user_id AND q.day = a.day AND q.answered_at IS NOT NULL) AS answered
    FROM quiz_attempts a WHERE a.user_id = ${userId} AND a.day = ${day}::date
  `;
  if (a?.finished) return { kind: "done", result: (await getResult(sql, userId, day))! };
  if (a) return { kind: "playing", answered: a.answered };
  const [ok] = await sql<{ ok: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM quiz_days WHERE day = ${day}::date)
        OR (SELECT count(*) FROM quiz_questions WHERE active) >= ${QUESTIONS_PER_DAY} AS ok
  `;
  return ok.ok ? { kind: "ready" } : { kind: "unavailable" };
}

/** Starts today's quiz (or picks up where the user left off; the clock kept running). */
export async function startQuiz(db: Db, userId: string, state: string): Promise<Step> {
  const day = lagosDate();
  await db`INSERT INTO quiz_attempts (user_id, day, state) VALUES (${userId}, ${day}::date, ${state}) ON CONFLICT DO NOTHING`;
  const [a] = await db<{ finished: boolean }[]>`
    SELECT (finished_at IS NOT NULL) AS finished FROM quiz_attempts WHERE user_id = ${userId} AND day = ${day}::date FOR UPDATE
  `;
  if (a.finished) return { question: null, result: await getResult(db, userId, day), streak: null };
  return advance(db, userId, day);
}

export type Answered = Step & {
  /** Feedback for the question just answered; null when it wasn't the open question (another tab, or too late). */
  feedback: { idx: number; correct: boolean; timedOut: boolean; rightChoice: number; points: number; fact: string | null } | null;
};

/**
 * Answers question `idx` of the attempt on `day` with a shown position, or null when time ran out.
 * Returns the reveal, and the result after the last question.
 */
export async function answerQuestion(db: Db, userId: string, day: string, idx: number, choice: number | null): Promise<Answered> {
  const [a] = await db`
    SELECT 1 FROM quiz_attempts WHERE user_id = ${userId} AND day = ${day}::date AND finished_at IS NULL FOR UPDATE
  `;
  if (!a) return { question: null, result: await getResult(db, userId, day), streak: null, feedback: null };

  const [row] = (await answerRows(db, userId, day)).filter((r) => r.idx === idx);
  if (!row || row.answered) return { ...(await advance(db, userId, day)), feedback: null };

  const timedOut = choice === null || row.elapsed_ms > LIMIT_MS + GRACE_MS;
  const correct = !timedOut && row.perm[choice!] === 0;
  const speed = Math.min(1, Math.max(0, LIMIT_MS + NETWORK_ALLOWANCE_MS - row.elapsed_ms) / LIMIT_MS);
  const points = correct ? BASE_POINTS + Math.round(SPEED_POINTS * speed) : 0;
  await db`
    UPDATE quiz_answers SET answered_at = now(), choice = ${timedOut ? null : choice}, correct = ${correct}, points = ${points}
    WHERE user_id = ${userId} AND day = ${day}::date AND idx = ${idx}
  `;
  await db`
    UPDATE quiz_attempts SET points = points + ${points}, correct = correct + ${correct ? 1 : 0}
    WHERE user_id = ${userId} AND day = ${day}::date
  `;
  const [q] = await db<{ fact: string | null }[]>`SELECT fact FROM quiz_questions WHERE id = ${row.question_id}`;
  const feedback = { idx, correct, timedOut, rightChoice: row.perm.indexOf(0), points, fact: q?.fact ?? null };
  // The next question is served when the player moves on (startQuiz), so its clock doesn't run during the reveal.
  if (idx + 1 >= QUESTIONS_PER_DAY) return { ...(await finish(db, userId, day)), feedback };
  return { question: null, result: null, streak: null, feedback };
}
