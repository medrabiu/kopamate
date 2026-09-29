import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const rows = await sql<{ photo_data: string | null; photo_mime: string | null }[]>`
    SELECT photo_data, photo_mime FROM users WHERE id = ${id} AND NOT is_banned
  `;
  const row = rows[0];
  if (!row?.photo_data || !row.photo_mime) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(row.photo_data, "base64")), {
    headers: {
      "Content-Type": row.photo_mime,
      // URLs carry ?v=<version>, so a new photo gets a new URL.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
