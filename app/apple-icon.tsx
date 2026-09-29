import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#C6F432",
          color: "#0E0E10",
          fontSize: 110,
          fontWeight: 800,
        }}
      >
        K
      </div>
    ),
    size,
  );
}
