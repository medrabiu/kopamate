export type Theme = "dark" | "light";

/**
 * Light mode is this cookie. Pages are rendered the same for everyone (so the public ones can be cached), and
 * themeBootScript applies the cookie in <head> before anything paints, so nothing flashes.
 */
export const THEME_COOKIE = "km_theme";
const LEGACY_KEY = "kopamate-theme";
export const THEME_COLOR: Record<Theme, string> = { dark: "#000000", light: "#FFFFFF" };

/**
 * Moves the old localStorage setting into the cookie for people who switched on light mode before
 * it was saved in a cookie. Runs in <head> before the page paints; a plain string because it runs before React.
 */
export const themeMigrationScript = `(function(){try{if(document.cookie.indexOf("${THEME_COOKIE}=")<0&&localStorage.getItem("${LEGACY_KEY}")==="light"){document.cookie="${THEME_COOKIE}=light;path=/;max-age=31536000;samesite=lax";document.documentElement.dataset.theme="light";localStorage.removeItem("${LEGACY_KEY}")}}catch(e){}})()`;

/**
 * Runs first in <head>: applies the theme cookie (light mode) before the page paints, then points the theme-color
 * meta and the install manifest at the light versions once they're in the document.
 */
export const themeBootScript = `(function(){try{if(document.cookie.indexOf("${THEME_COOKIE}=light")>=0){var d=document.documentElement;d.dataset.theme="light";var f=function(){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","${THEME_COLOR.light}");var l=document.querySelector('link[rel="manifest"]');if(l)l.setAttribute("href","/manifest.webmanifest?theme=light")};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",f);else f()}}catch(e){}})()`;

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  // So installing from here gets the matching splash colour (app/manifest.webmanifest).
  document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.setAttribute("href", theme === "light" ? "/manifest.webmanifest?theme=light" : "/manifest.webmanifest");
  document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=31536000;samesite=lax`;
}
