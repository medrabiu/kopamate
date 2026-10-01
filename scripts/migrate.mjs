// Applies db/schema.sql to DATABASE_URL. Safe to run more than once.
// Usage: DATABASE_URL=... npm run db:migrate   (or put DATABASE_URL in .env)
import { readFileSync, existsSync } from "node:fs";
import postgres from "postgres";
import { parseConnectionString } from "../lib/connection-string.mjs";

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
const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

try {
  await sql.unsafe(schema);
  console.log("Database is ready.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
