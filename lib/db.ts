import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __kopamateSql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  // Connects lazily on the first query, so importing this during `next build` is safe.
  const options = {
    // Required for Supabase's transaction pooler; harmless elsewhere.
    prepare: false,
    max: 5,
    idle_timeout: 20,
  };
  const url = process.env.DATABASE_URL;
  return url ? postgres(url, options) : postgres(options);
}

/** One shared client per server process (survives hot reloads in dev). */
export const sql = globalThis.__kopamateSql ?? (globalThis.__kopamateSql = createClient());
