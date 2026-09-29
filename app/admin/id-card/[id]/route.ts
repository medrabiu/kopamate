import { sql } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/** NYSC ID card photo for a pending verification. Admins only, never cached. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return new Response("Not found", { status: 404 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const rows = await sql<{ id_card_data: string | null; id_card_mime: string | null }[]>`
    SELECT id_card_data, id_card_mime FROM users WHERE id = ${id}
  `;
  const row = rows[0];
  if (!row?.id_card_data || !row.id_card_mime) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(row.id_card_data, "base64")), {
    headers: {
      "Content-Type": row.id_card_mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
