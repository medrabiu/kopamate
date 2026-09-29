import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { APP_NAME } from "./config";
import { avatarColor } from "./util";

export const OG_SIZE = { width: 1200, height: 630 };

export type OgInviter = {
  id: string;
  nickname: string;
  /** data: URL of their profile photo (JPEG or PNG only), or null to show their initial. */
  photo: string | null;
};

const LIME = "#C6F432";
const PINK = "#FF4FA3";
const AMBER = "#FFB547";
const VIOLET = "#8B7BFF";
const TEAL = "#4FD1C5";

const fontFile = (pkg: string, file: string) => readFile(join(process.cwd(), "node_modules/@fontsource", pkg, "files", file));

async function fonts() {
  const [display, body] = await Promise.all([
    fontFile("bricolage-grotesque", "bricolage-grotesque-latin-800-normal.woff"),
    fontFile("dm-sans", "dm-sans-latin-700-normal.woff"),
  ]);
  return [
    { name: "Bricolage", data: display, weight: 800 as const, style: "normal" as const },
    { name: "DM Sans", data: body, weight: 700 as const, style: "normal" as const },
  ];
}

function Sparkle({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="-8 -8 16 16" style={{ position: "absolute", left: x, top: y }}>
      <path d="M0-7 1.8-1.8 7 0 1.8 1.8 0 7-1.8 1.8-7 0-1.8-1.8Z" fill={color} />
    </svg>
  );
}

function Face({ size, color, letter, photo }: { size: number; color: string; letter: string; photo?: string | null }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} width={size} height={size} style={{ width: size, height: size, borderRadius: size / 2, objectFit: "cover" }} alt="" />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: color,
        color: "#0E0E10",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Bricolage",
        fontSize: size * 0.44,
      }}
    >
      {letter}
    </div>
  );
}

/** Right-hand art: the inviter's face in a lime ring, or a small crowd of corpers when there's no inviter. */
function Art({ inviter }: { inviter?: OgInviter | null }) {
  return (
    <div style={{ position: "relative", width: 400, height: 486, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", left: 40, top: 60, width: 340, height: 340, borderRadius: 170, background: PINK, opacity: 0.16 }} />
      {inviter ? (
        <div style={{ display: "flex", padding: 12, borderRadius: 999, border: `10px solid ${LIME}`, background: "#0E0E10" }}>
          <Face size={240} color={avatarColor(inviter.id)} letter={(inviter.nickname.trim()[0] || "?").toUpperCase()} photo={inviter.photo} />
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center" }}>
          {[
            ["A", LIME],
            ["T", AMBER],
            ["N", TEAL],
            ["K", VIOLET],
          ].map(([letter, color], i) => (
            <div key={letter} style={{ display: "flex", marginLeft: i ? -34 : 0, borderRadius: 999, border: "8px solid #0E0E10" }}>
              <Face size={120} color={color} letter={letter} />
            </div>
          ))}
        </div>
      )}
      <Sparkle x={30} y={70} size={56} color={LIME} />
      <Sparkle x={330} y={360} size={48} color={PINK} />
      <Sparkle x={340} y={60} size={30} color={AMBER} />
      <Sparkle x={60} y={380} size={26} color={TEAL} />
    </div>
  );
}

/** Share preview image in the Social Night style. With an inviter: "Chidi invited you" and their face. */
export async function ogImage(inviter?: OgInviter | null) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#0E0E10",
          color: "#F5F5F0",
          padding: "72px 64px 72px 80px",
          fontFamily: "DM Sans",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", maxWidth: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                background: LIME,
                color: "#0E0E10",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Bricolage",
                fontSize: 38,
              }}
            >
              K
            </div>
            <div style={{ fontFamily: "Bricolage", fontSize: 40 }}>{APP_NAME}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {inviter ? (
              <div style={{ fontSize: 44, color: LIME, marginBottom: 18, display: "flex" }}>
                {`${inviter.nickname.length > 16 ? `${inviter.nickname.slice(0, 15)}…` : inviter.nickname} invited you`}
              </div>
            ) : null}
            <div style={{ fontFamily: "Bricolage", fontSize: 88, lineHeight: 1.04 }}>Every corper.</div>
            <div style={{ fontFamily: "Bricolage", fontSize: 88, lineHeight: 1.04, color: PINK }}>One place.</div>
          </div>
          <div style={{ display: "flex", fontSize: 32, color: "#A8A8A0" }}>Prizes for the first 500 corpers to join</div>
        </div>
        <Art inviter={inviter} />
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}
