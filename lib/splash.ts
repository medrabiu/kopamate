import type { Theme } from "./theme";

/**
 * iPhone screens that get a launch image when Kopamate is opened from the home screen (CSS points + pixel
 * ratio). iOS only shows a startup image whose media query matches the phone exactly, so each size is listed.
 * Rendered by app/splash/[size]/route.tsx and linked from app/layout.tsx.
 */
const SCREENS: [width: number, height: number, ratio: number][] = [
  [440, 956, 3], // 16 Pro Max
  [402, 874, 3], // 16 Pro
  [430, 932, 3], // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [390, 844, 3], // 12, 13, 14, 16e
  [375, 812, 3], // X, XS, 11 Pro, 12/13 mini
  [414, 896, 3], // XS Max, 11 Pro Max
  [414, 896, 2], // XR, 11
  [414, 736, 3], // 6–8 Plus
  [375, 667, 2], // 6–8, SE 2nd/3rd gen
  [320, 568, 2], // SE 1st gen
];

/** Paths like "dark-1290x2796", one per theme and pixel size; the route only renders these. */
export const SPLASH_SIZES = (["dark", "light"] as const).flatMap((theme) => [
  ...new Set(SCREENS.map(([w, h, r]) => `${theme}-${w * r}x${h * r}`)),
]);

/** The launch images for the theme the page is rendered in. */
export const splashImages = (theme: Theme) =>
  SCREENS.map(([w, h, r]) => ({
    url: `/splash/${theme}-${w * r}x${h * r}`,
    media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
  }));
