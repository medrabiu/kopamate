export type Theme = "dark" | "light";

const KEY = "kopamate-theme";
const THEME_COLOR: Record<Theme, string> = { dark: "#0E0E10", light: "#F6F6F1" };

/**
 * Runs in <head> before the page paints so a saved light theme never flashes dark.
 * Kept as a plain string because it executes before React loads.
 */
export const themeScript = `(function(){try{if(localStorage.getItem("${KEY}")==="light"){document.documentElement.dataset.theme="light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.content="${THEME_COLOR.light}"}}catch(e){}})()`;

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") root.dataset.theme = "light";
  else delete root.dataset.theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  try {
    if (theme === "light") localStorage.setItem(KEY, "light");
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode or blocked storage: the switch still works for this visit.
  }
}
