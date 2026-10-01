// Applies db/schema.sql to DATABASE_URL. Safe to run more than once.
// Usage: DATABASE_URL=... npm run db:migrate   (or put DATABASE_URL in .env)
import { readFileSync, existsSync } from "node:fs";
import postgres from "postgres";

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

// Accept passwords with unencoded special characters (as copied from Supabase); see lib/db.ts.
function connectionUrl(url) {
  try {
    new URL(url);
    return url;
  } catch {
    const m = url.match(/^([a-z]+:\/\/)([^:/@]+):(.*)@([^@]+)$/i);
    if (!m) return url;
    let pw = m[3];
    try { pw = decodeURIComponent(pw); } catch {}
    return `${m[1]}${m[2]}:${encodeURIComponent(pw)}@${m[4]}`;
  }
}

const sql = postgres(connectionUrl(process.env.DATABASE_URL), { prepare: false, max: 1 });
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
