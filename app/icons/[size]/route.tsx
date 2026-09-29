import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

/** App icon: a lime "K" on the dark background. */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = (await params).size === "192" ? 192 : 512;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0E0E10",
        }}
      >
        <div
          style={{
            width: size * 0.62,
            height: size * 0.62,
            borderRadius: size * 0.31,
            background: "#C6F432",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0E0E10",
            fontSize: size * 0.4,
            fontWeight: 800,
          }}
        >
          K
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
