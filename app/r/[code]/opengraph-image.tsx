import { OG_SIZE, ogImage, type OgInviter } from "@/lib/og";
import { sql } from "@/lib/db";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Join Kopamate";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, "");
  let inviter: OgInviter | null = null;
  try {
    const rows = await sql<{ id: string; nickname: string; photo_data: string | null; photo_mime: string | null }[]>`
      SELECT id, nickname,
             CASE WHEN photo_mime IN ('image/jpeg', 'image/png') THEN photo_data END AS photo_data, photo_mime
      FROM users WHERE referral_code = ${clean} AND completed_at IS NOT NULL AND NOT is_banned
    `;
    const row = rows[0];
    // Only JPEG/PNG photos are embedded (the image renderer can't be relied on for WebP); others show their initial.
    if (row) inviter = { id: row.id, nickname: row.nickname, photo: row.photo_data ? `data:${row.photo_mime};base64,${row.photo_data}` : null };
  } catch {}
  return ogImage(inviter);
}
