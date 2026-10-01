import { APP_NAME } from "@/lib/config";

type Props = { position: string; nickname: string; state: string | null; link: string };

/**
 * Small preview of the WhatsApp Status card (app/card/[code]/route.tsx), drawn in HTML at full size
 * and scaled to 10%, so Home doesn't download the 1080×1920 PNG (~80 KB) just for a thumbnail.
 * The PNG is only fetched when someone taps "Post to Status". Keep the two layouts in step.
 */
export default function StatusCardPreview({ position, nickname, state, link }: Props) {
  const display = { fontFamily: "var(--font-display)", fontWeight: 800 } as const;
  return (
    <div
      role="img"
      aria-label={`Status card: I'm ${position} on ${APP_NAME}`}
      className="relative h-[192px] w-[108px] shrink-0 self-start overflow-hidden rounded-xl"
    >
      <div
        aria-hidden="true"
        style={{
          width: 1080,
          height: 1920,
          transform: "scale(0.1)",
          transformOrigin: "top left",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0E0E10",
          color: "#F5F5F0",
          padding: "120px 96px",
          fontFamily: "var(--font-sans)",
          fontWeight: 700,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              ...display,
              width: 80,
              height: 80,
              borderRadius: 40,
              background: "#C6F432",
              color: "#0E0E10",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
            }}
          >
            K
          </div>
          <div style={{ ...display, fontSize: 52 }}>{APP_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ ...display, fontSize: 88 }}>I&apos;m</div>
          <div style={{ ...display, fontSize: position.length > 6 ? 240 : 300, lineHeight: 0.95, color: "#C6F432", letterSpacing: -8 }}>
            {position}
          </div>
          <div style={{ ...display, fontSize: 88 }}>on {APP_NAME}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 56 }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: "#FF4FA3" }} />
            <div style={{ fontSize: 48, color: "#A8A8A0" }}>{state ? `${nickname} · ${state}` : nickname}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 56 }}>
          <div style={{ ...display, fontSize: 96, lineHeight: 1.02 }}>
            Every corper.
            <br />
            <span style={{ color: "#FF4FA3" }}>One place.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, borderRadius: 40, border: "4px solid #C6F432", padding: "36px 44px" }}>
            <div style={{ fontSize: 40, color: "#A8A8A0" }}>Join me:</div>
            <div style={{ fontSize: 52, color: "#C6F432" }}>{link}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
