import { ImageResponse } from "next/og";
import { APP_NAME } from "./config";

export const OG_SIZE = { width: 1200, height: 630 };

/** Share preview image in the Social Night style. */
export function ogImage(inviter?: string | null) {
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
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              background: "#C6F432",
              color: "#0E0E10",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 38,
              fontWeight: 800,
            }}
          >
            K
          </div>
          <div style={{ fontSize: 40, fontWeight: 800 }}>{APP_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {inviter ? (
            <div style={{ fontSize: 40, color: "#C6F432", marginBottom: 16 }}>{`${inviter} invited you`}</div>
          ) : null}
          <div style={{ fontSize: 104, fontWeight: 800, lineHeight: 1.02 }}>Every corper.</div>
          <div style={{ fontSize: 104, fontWeight: 800, lineHeight: 1.02, color: "#FF4FA3" }}>One place.</div>
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#A8A8A0" }}>
          Prizes for the first 500 corpers to join
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
