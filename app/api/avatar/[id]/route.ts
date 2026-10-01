import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** A user's photo. `?s=sm` serves the 144px thumbnail when there is one (small avatars in lists). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const small = new URL(req.url).searchParams.get("s") === "sm";
  const rows = await sql<{ photo_data: string | null; photo_mime: string | null }[]>`
    SELECT ${small ? sql`COALESCE(photo_thumb_data, photo_data)` : sql`photo_data`} AS photo_data,
           ${small ? sql`CASE WHEN photo_thumb_data IS NOT NULL THEN photo_thumb_mime ELSE photo_mime END` : sql`photo_mime`} AS photo_mime
    FROM users WHERE id = ${id} AND NOT is_banned
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
