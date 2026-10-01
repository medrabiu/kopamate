// Shared by lib/db.ts and the migrate/seed scripts (plain JS so the scripts can import it).

/**
 * Splits DATABASE_URL into host, port, user, password and database, instead of letting the postgres
 * driver parse it. Passwords copied from Supabase often contain "@", "%", "," or "/" without URL
 * encoding, and the driver's own parser fails on those ("Invalid URL", which also breaks `next build`;
 * a comma even reads as a second host). Encoded passwords work too. Quotes, spaces and
 * "DATABASE_URL=" pasted into the value are ignored. Returns {} when the value is empty.
 */
export function parseConnectionString(raw) {
  const url = (raw ?? "").trim().replace(/^DATABASE_URL\s*=\s*/, "").replace(/^["']|["']$/g, "").trim();
  if (!url) return {};
  // scheme://user:password@host[:port][/database][?params]. The host is after the LAST "@" (the
  // password may contain "@"), the user ends at the first ":".
  const m = url.match(/^postgres(?:ql)?:\/\/([^:@/]+)(?::(.*))?@([^@/?]+?)(?::(\d+))?(?:\/([^?]*))?(?:\?(.*))?$/i);
  if (!m) {
    // Never print the value: it contains the password.
    throw new Error(
      "DATABASE_URL is not a valid connection string. Expected postgresql://USER:PASSWORD@HOST:6543/postgres " +
        "(Supabase: Connect > Transaction pooler), with the real password in place of [YOUR-PASSWORD].",
    );
  }
  const [, user, password = "", host, port, database, query] = m;
  const decode = (v) => {
    try {
      return decodeURIComponent(v);
    } catch {
      return v; // A lone "%": the value wasn't encoded.
    }
  };
  const sslmode = new URLSearchParams(query ?? "").get("sslmode");
  return {
    host,
    port: port ? Number(port) : 5432,
    username: decode(user),
    password: decode(password),
    database: decode(database || "postgres"),
    ...(sslmode && sslmode !== "disable" ? { ssl: sslmode } : {}),
  };
}
