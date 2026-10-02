import postgres from "postgres";
import { parseConnectionString } from "./connection-string.mjs";

declare global {
  // eslint-disable-next-line no-var
  var __kopamateSql: ReturnType<typeof postgres> | undefined;
}

/**
 * Connection settings for Supabase's transaction pooler (port 6543) on serverless (Vercel).
 * Each serverless instance keeps its own small pool, so keep `max` low: many instances × max
 * connections must stay under the pooler's client limit. Override with DB_POOL_MAX if needed.
 */
function createClient() {
  // Connects lazily on the first query, so importing this during `next build` is safe.
  const options = {
    // Required for Supabase's transaction pooler; harmless elsewhere.
    prepare: false,
    // Strictly one query in flight per connection. Supabase's transaction pooler loses the reply to
    // a pipelined query, and the page waits forever. Note max_pipeline: 1 still lets a second query
    // through (the active one isn't counted), and parameterless queries like
    // `SELECT ... FROM badges` get pipelined: two of them on one connection hung every time in tests.
    // 0 means each query waits for the previous reply. Extra queries wait for a free connection.
    max_pipeline: 0,
    max: Math.max(1, Number(process.env.DB_POOL_MAX) || 3),
    // Give up on a connection attempt instead of hanging the request.
    connect_timeout: 10,
    // Release idle connections quickly and recycle old ones, so a bad connection doesn't live forever.
    idle_timeout: 20,
    max_lifetime: 60 * 10,
  };
  // Parsed here rather than by the driver, which fails on passwords with unencoded "@", "%" or ",".
  return postgres({ ...options, ...parseConnectionString(process.env.DATABASE_URL) });
}

/** One shared client per server process (survives hot reloads in dev). */
export const sql = globalThis.__kopamateSql ?? (globalThis.__kopamateSql = createClient());

/**
 * Runs `fn` in a transaction on one reserved connection. Use this, not sql.begin: with max_pipeline 0,
 * postgres.js never reserves the connection for sql.begin and every call fails with UNSAFE_TRANSACTION.
 */
export async function transaction<T>(fn: (tx: postgres.ReservedSql) => Promise<T>): Promise<T> {
  const tx = await sql.reserve();
  try {
    await tx`BEGIN`;
    const result = await fn(tx);
    await tx`COMMIT`;
    return result;
  } catch (err) {
    await tx`ROLLBACK`.catch(() => {});
    throw err;
  } finally {
    tx.release();
  }
}
