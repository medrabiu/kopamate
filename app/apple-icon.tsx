import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/Logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS rounds the corners itself, so the mark goes in full-bleed. */
export default function AppleIcon() {
  return new ImageResponse(<LogoMark size={180} fullBleed />, size);
}
