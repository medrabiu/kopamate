import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/Logo";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "maskable" }];
}

/**
 * App icon: the Rise mark. "maskable" is a full-bleed 512 for Android, which crops it to its own shape;
 * the K sits inside the 80% safe zone either way.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const key = (await params).size;
  const size = key === "192" ? 192 : 512;
  return new ImageResponse(<LogoMark size={size} fullBleed={key === "maskable"} />, { width: size, height: size });
}
