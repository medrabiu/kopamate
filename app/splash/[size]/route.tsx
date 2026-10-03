import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/Logo";
import { SPLASH_SIZES } from "@/lib/splash";
import { THEME_COLOR } from "@/lib/theme";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return SPLASH_SIZES.map((size) => ({ size }));
}

/** iPhone launch screen: the Rise mark on the user's theme background, shown while the home-screen app opens. */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const [theme, dims] = (await params).size.split("-");
  const [width, height] = dims.split("x").map(Number);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: THEME_COLOR[theme === "light" ? "light" : "dark"] }}>
        <LogoMark size={Math.round(width * 0.28)} />
      </div>
    ),
    { width, height },
  );
}
