import { OG_SIZE, ogImage } from "@/lib/og";
import { sql } from "@/lib/db";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Join Kopamate";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, "");
  let nickname: string | null = null;
  try {
    const rows = await sql<{ nickname: string }[]>`
      SELECT nickname FROM users WHERE referral_code = ${clean} AND completed_at IS NOT NULL AND NOT is_banned
    `;
    nickname = rows[0]?.nickname ?? null;
  } catch {}
  return ogImage(nickname);
}
