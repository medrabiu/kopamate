import postgres from "postgres";

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
    // Send one query at a time per connection. Pipelined queries through Supabase's transaction
    // pooler can leave server connections stuck mid-query, which starves the pool: pages hang,
    // then fail with CONNECTION_CLOSED. Extra queries wait for a free connection instead.
    max_pipeline: 1,
    max: Math.max(1, Number(process.env.DB_POOL_MAX) || 3),
    // Give up on a connection attempt instead of hanging the request.
    connect_timeout: 10,
    // Release idle connections quickly and recycle old ones, so a bad connection doesn't live forever.
    idle_timeout: 20,
    max_lifetime: 60 * 10,
  };
  const url = process.env.DATABASE_URL;
  return url ? postgres(url, options) : postgres(options);
}

/** One shared client per server process (survives hot reloads in dev). */
export const sql = globalThis.__kopamateSql ?? (globalThis.__kopamateSql = createClient());
