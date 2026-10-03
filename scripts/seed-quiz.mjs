// Loads the starting Daily Quiz questions (scripts/quiz-bank.mjs) into DATABASE_URL.
// Safe to run again: questions already in the bank (same wording) are skipped, and edits made in admin are kept.
// Usage: npm run db:quiz   (reads DATABASE_URL from .env if it isn't set)
import { readFileSync, existsSync } from "node:fs";
import postgres from "postgres";
import { parseConnectionString } from "../lib/connection-string.mjs";
import { QUIZ_BANK } from "./quiz-bank.mjs";

if (!process.env.DATABASE_URL && existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres({ ...parseConnectionString(process.env.DATABASE_URL), prepare: false, max: 1 });
try {
  let added = 0;
  for (const [category, difficulty, question, ...options] of QUIZ_BANK) {
    const rows = await sql`
      INSERT INTO quiz_questions (category, difficulty, question, options)
      VALUES (${category}, ${difficulty}, ${question}, ${options}::text[])
      ON CONFLICT (question) DO NOTHING RETURNING id
    `;
    added += rows.length;
  }
  console.log(`Added ${added} of ${QUIZ_BANK.length} questions (the rest were already there).`);
} catch (err) {
  console.error("Loading questions failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
