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
  const url = connectionUrl(process.env.DATABASE_URL);
  return url ? postgres(url, options) : postgres(options);
}

/**
 * Accepts a connection string whose password has unencoded special characters (e.g. "@", "&", "!"),
 * as copied from Supabase. Without this, the driver throws "Invalid URL" when the module loads,
 * which also fails `next build`.
 */
function connectionUrl(raw: string | undefined) {
  // Also forgive quotes, spaces and "DATABASE_URL=" pasted into the value.
  const url = raw?.trim().replace(/^DATABASE_URL\s*=\s*/, "").replace(/^["']|["']$/g, "").trim();
  if (!url) return url;
  const valid = (u: string) => {
    try {
      new URL(u);
      return true;
    } catch {
      return false;
    }
  };
  if (valid(url)) return url;
  // scheme://user:password@host...: the host follows the last "@", the user ends at the first ":".
  const m = url.match(/^([a-z]+:\/\/)([^:/@]+):(.*)@([^@]+)$/i);
  if (m) {
    const [, scheme, user, password, rest] = m;
    let decoded = password;
    try {
      decoded = decodeURIComponent(password);
    } catch {
      // A lone "%" means the password wasn't encoded at all.
    }
    const fixed = `${scheme}${user}:${encodeURIComponent(decoded)}@${rest}`;
    if (valid(fixed)) return fixed;
  }
  // Never print the value: it contains the password.
  throw new Error(
    "DATABASE_URL is not a valid connection string. Expected postgresql://USER:PASSWORD@HOST:6543/postgres " +
      "(Supabase: Connect > Transaction pooler), with no spaces and the real password in place of [YOUR-PASSWORD].",
  );
}

/** One shared client per server process (survives hot reloads in dev). */
export const sql = globalThis.__kopamateSql ?? (globalThis.__kopamateSql = createClient());
