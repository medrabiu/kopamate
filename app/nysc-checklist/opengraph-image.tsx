import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/Logo";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "NYSC checklist: get camp-ready, on Kopamate";

/** Static share image for /nysc-checklist. */
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0e0e10", padding: 72, color: "#f5f5f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <LogoMark size={72} />
          <span style={{ fontSize: 40, fontWeight: 800 }}>Kopamate</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>NYSC checklist</span>
          <span style={{ fontSize: 44, fontWeight: 700, color: "#c6f432" }}>Get camp-ready, step by step ✅</span>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 30, color: "#a8a8a0" }}>
          <span>Senate list · NERD · Registration · Call-up · Camp Pack</span>
        </div>
      </div>
    ),
    size,
  );
}
