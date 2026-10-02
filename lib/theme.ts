export type Theme = "dark" | "light";

/** Cookie read by app/layout.tsx, so the server renders <html data-theme="light"> and nothing flashes. */
export const THEME_COOKIE = "km_theme";
const LEGACY_KEY = "kopamate-theme";
export const THEME_COLOR: Record<Theme, string> = { dark: "#000000", light: "#FFFFFF" };

/**
 * Moves the old localStorage setting into the cookie for people who switched on light mode before
 * it was saved in a cookie. Runs in <head> before the page paints; a plain string because it runs before React.
 */
export const themeMigrationScript = `(function(){try{if(document.cookie.indexOf("${THEME_COOKIE}=")<0&&localStorage.getItem("${LEGACY_KEY}")==="light"){document.cookie="${THEME_COOKIE}=light;path=/;max-age=31536000;samesite=lax";document.documentElement.dataset.theme="light";localStorage.removeItem("${LEGACY_KEY}")}}catch(e){}})()`;

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=31536000;samesite=lax`;
}
