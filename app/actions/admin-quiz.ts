"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { isUniqueViolation } from "@/lib/signup";

const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim().replace(/\s+/g, " ");

/** Adds a quiz question. The right answer is stored first; players see the options shuffled. */
export async function addQuizQuestion(fd: FormData) {
  await requireAdmin();
  const category = clean(fd.get("category")).slice(0, 40);
  const difficulty = Number(fd.get("difficulty"));
  const question = clean(fd.get("question")).slice(0, 300);
  const options = ["right", "wrong1", "wrong2", "wrong3"].map((k) => clean(fd.get(k)).slice(0, 120));
  const fact = clean(fd.get("fact")).slice(0, 200) || null;
  if (!category || !question || options.some((o) => !o) || ![1, 2, 3].includes(difficulty)) {
    redirect("/admin/quiz?error=missing");
  }
  if (new Set(options.map((o) => o.toLowerCase())).size < 4) redirect("/admin/quiz?error=duplicate-options");
  try {
    await sql`
      INSERT INTO quiz_questions (category, difficulty, question, options, fact)
      VALUES (${category}, ${difficulty}, ${question}, ${options}::text[], ${fact})
    `;
  } catch (err) {
    if (isUniqueViolation(err)) redirect("/admin/quiz?error=exists");
    throw err;
  }
  revalidatePath("/admin/quiz");
  redirect("/admin/quiz?added=1");
}

/** Takes a question out of rotation (or puts it back). Days already played keep it. */
export async function toggleQuizQuestion(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id)) return;
  await sql`UPDATE quiz_questions SET active = NOT active WHERE id = ${id}`;
  revalidatePath("/admin/quiz");
}
