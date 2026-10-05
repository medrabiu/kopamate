import { getCurrentUser, isAdmin } from "@/lib/session";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** An entry's stats screenshot. Admins only, never cached. */
export async function GET(_req: Request, { params }: { params: Promise<{ entry: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return new Response("Not found", { status: 404 });
  const id = Number((await params).entry);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });
  const [row] = await sql<{ data: string | null; mime: string | null }[]>`
    SELECT metrics_screenshot AS data, metrics_screenshot_mime AS mime FROM challenge_entries WHERE id = ${id}
  `;
  if (!row?.data || !row.mime) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(row.data, "base64"), {
    headers: { "Content-Type": row.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
