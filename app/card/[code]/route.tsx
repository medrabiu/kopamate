import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { sql } from "@/lib/db";
import { getRank } from "@/lib/ranking";
import { APP_NAME, referralLink } from "@/lib/config";
import { formatNumber } from "@/lib/util";

export const runtime = "nodejs";

const SIZE = { width: 1080, height: 1920 };

const fontFile = (pkg: string, file: string) => readFile(join(process.cwd(), "node_modules/@fontsource", pkg, "files", file));

/** WhatsApp Status card (1080×1920) showing someone's live position and their invite link. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
  const rows = clean
    ? await sql<{ id: string; nickname: string; state: string | null; referral_code: string }[]>`
        SELECT id, nickname, state, referral_code FROM users
        WHERE referral_code = ${clean} AND completed_at IS NOT NULL AND NOT is_banned
      `
    : [];
  const user = rows[0];
  const rank = user ? await getRank(user.id) : null;
  if (!user || !rank) return new Response("Not found", { status: 404 });

  const [display, body] = await Promise.all([
    fontFile("bricolage-grotesque", "bricolage-grotesque-latin-800-normal.woff"),
    fontFile("dm-sans", "dm-sans-latin-700-normal.woff"),
  ]);
  const link = referralLink(user.referral_code).replace(/^https?:\/\//, "");
  const position = `#${formatNumber(rank.position)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0E0E10",
          color: "#F5F5F0",
          padding: "120px 96px",
          fontFamily: "DM Sans",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              background: "#C6F432",
              color: "#0E0E10",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Bricolage",
              fontSize: 48,
            }}
          >
            K
          </div>
          <div style={{ fontFamily: "Bricolage", fontSize: 52 }}>{APP_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "Bricolage", fontSize: 88 }}>I&apos;m</div>
          <div
            style={{
              fontFamily: "Bricolage",
              fontSize: position.length > 6 ? 240 : 300,
              lineHeight: 0.95,
              color: "#C6F432",
              letterSpacing: -8,
            }}
          >
            {position}
          </div>
          <div style={{ fontFamily: "Bricolage", fontSize: 88 }}>{`on ${APP_NAME}`}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 56 }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: "#FF4FA3" }} />
            <div style={{ fontSize: 48, color: "#A8A8A0" }}>
              {user.state ? `${user.nickname} · ${user.state}` : user.nickname}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 56 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Bricolage", fontSize: 96, lineHeight: 1.02 }}>Every corper.</div>
            <div style={{ fontFamily: "Bricolage", fontSize: 96, lineHeight: 1.02, color: "#FF4FA3" }}>One place.</div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              borderRadius: 40,
              border: "4px solid #C6F432",
              padding: "36px 44px",
            }}
          >
            <div style={{ fontSize: 40, color: "#A8A8A0" }}>Join me:</div>
            <div style={{ fontSize: 52, color: "#C6F432" }}>{link}</div>
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: [
        { name: "Bricolage", data: display, weight: 800, style: "normal" },
        { name: "DM Sans", data: body, weight: 700, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    },
  );
}
