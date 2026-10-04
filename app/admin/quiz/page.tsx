import type { Metadata } from "next";
import { addQuizQuestion, toggleQuizQuestion } from "@/app/actions/admin-quiz";
import { sql } from "@/lib/db";
import { QUESTIONS_PER_DAY } from "@/lib/quiz";
import { requireAdmin } from "@/lib/session";
import { lagosDate } from "@/lib/util";
import { btn, btnPrimary, input, panel } from "../ui";

export const metadata: Metadata = { title: "Quiz" };

const ERRORS: Record<string, string> = {
  missing: "Fill in every field.",
  "duplicate-options": "The four answers must all be different.",
  exists: "That question is already in the bank.",
};

type Row = {
  id: number;
  category: string;
  difficulty: number;
  question: string;
  options: string[];
  active: boolean;
  last_used_on: string | null;
  answered: number;
  right: number;
};

export default async function AdminQuizPage({ searchParams }: { searchParams: Promise<{ added?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = lagosDate();
  const [rows, [todayRow], [players], weeks] = await Promise.all([
    sql<Row[]>`
      SELECT q.id, q.category, q.difficulty, q.question, q.options, q.active, q.last_used_on::text,
             count(a.question_id)::int AS answered, count(a.question_id) FILTER (WHERE a.correct)::int AS right
      FROM quiz_questions q LEFT JOIN quiz_answers a ON a.question_id = q.id AND a.answered_at IS NOT NULL
      GROUP BY q.id ORDER BY q.last_used_on DESC NULLS LAST, q.id DESC
    `,
    sql<{ question_ids: number[] }[]>`SELECT question_ids FROM quiz_days WHERE day = ${today}::date`,
    sql<{ started: number; finished: number }[]>`
      SELECT count(*)::int AS started, count(finished_at)::int AS finished FROM quiz_attempts WHERE day = ${today}::date
    `,
    sql<{ week: string; winner_state: string | null; top: string | null }[]>`
      SELECT week::text, winner_state, top_players->0->>'nickname' AS top FROM league_weeks ORDER BY week DESC LIMIT 12
    `,
  ]);
  const fresh = rows.filter((r) => r.active && !r.last_used_on).length;
  const active = rows.filter((r) => r.active).length;
  const categories = [...new Set(rows.map((r) => r.category))].sort();
  const todays = todayRow ? todayRow.question_ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean) : [];

  return (
    <>
      {sp.added && <p role="status" className="rounded-2xl border border-lime p-4 text-sm">Question added.</p>}
      {sp.error && <p role="alert" className="rounded-2xl border border-pink p-4 text-sm">{ERRORS[sp.error] ?? "Something went wrong."}</p>}

      <section className={panel}>
        <h2 className="h-display mb-2 text-lg">Daily Quiz</h2>
        <p className="text-sm">
          {active} active questions · {fresh} never used · today {players.started} started, {players.finished} finished.
        </p>
        <p className="mt-2 text-sm text-muted">
          Each day takes one question from {QUESTIONS_PER_DAY} different categories, so every category is used about equally. Never-used
          questions left per category (when one runs out, its oldest questions come back):
        </p>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {categories.map((c) => {
            const left = rows.filter((r) => r.category === c && r.active && !r.last_used_on).length;
            return (
              <li key={c} className={left < 10 ? "font-bold text-pink-ink" : ""}>
                {c}: {left}
              </li>
            );
          })}
        </ul>
        {todays.length > 0 && (
          <ol className="mt-3 flex list-decimal flex-col gap-1 pl-5 text-sm">
            {todays.map((q) => (
              <li key={q!.id}>
                {q!.question} <span className="text-muted">· {q!.options[0]}</span>
                {q!.answered > 0 && <span className="text-muted"> · {Math.round((q!.right / q!.answered) * 100)}% right</span>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={panel}>
        <h2 className="h-display mb-3 text-lg">Add a question</h2>
        <form action={addQuizQuestion} className="grid gap-2 sm:grid-cols-2">
          <input name="category" list="quiz-categories" placeholder="Category" className={input} required />
          <datalist id="quiz-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <select name="difficulty" defaultValue="2" className={input}>
            <option value="1">Easy</option>
            <option value="2">Medium</option>
            <option value="3">Hard</option>
          </select>
          <input name="question" placeholder="Question" className={`${input} sm:col-span-2`} required />
          <input name="right" placeholder="Right answer" className={`${input} border-lime`} required />
          <input name="wrong1" placeholder="Wrong answer" className={input} required />
          <input name="wrong2" placeholder="Wrong answer" className={input} required />
          <input name="wrong3" placeholder="Wrong answer" className={input} required />
          <input name="fact" placeholder="Fun fact for the back of the card (optional)" className={`${input} sm:col-span-2`} />
          <div>
            <button className={btnPrimary}>Add question</button>
          </div>
        </form>
      </section>

      {weeks.length > 0 && (
        <section className={panel}>
          <h2 className="h-display mb-2 text-lg">League winners</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {weeks.map((w) => (
              <li key={w.week}>
                Week of {w.week}: <b>{w.winner_state ?? "no winner"}</b>
                {w.top && <span className="text-muted"> · MVP {w.top}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={panel}>
        <h2 className="h-display mb-3 text-lg">Question bank ({rows.length})</h2>
        <p className="mb-3 text-sm text-muted">
          Switch off anything wrong or unclear. Very low or very high “% right” after a day can mean a confusing question.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-1.5 pr-3">Question</th>
                <th className="py-1.5 pr-3">Answer</th>
                <th className="py-1.5 pr-3">Category</th>
                <th className="py-1.5 pr-3">Used</th>
                <th className="py-1.5 pr-3">% right</th>
                <th className="py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-t border-line align-top ${r.active ? "" : "opacity-50"}`}>
                  <td className="py-2 pr-3">{r.question}</td>
                  <td className="py-2 pr-3">{r.options[0]}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {r.category} · {"★".repeat(r.difficulty)}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.last_used_on ?? "–"}</td>
                  <td className="py-2 pr-3">{r.answered ? `${Math.round((r.right / r.answered) * 100)}% of ${r.answered}` : "–"}</td>
                  <td className="py-2">
                    <form action={toggleQuizQuestion}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className={btn}>{r.active ? "Switch off" : "Switch on"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
