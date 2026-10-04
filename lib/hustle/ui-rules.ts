/** My Hustle display modes: the pure rules, shared by the server helper (lib/hustle/ui-mode.ts) and the tests. */

export const UI_SETTINGS = ["graphical", "text", "graphical_only"] as const;
export type UiSetting = (typeof UI_SETTINGS)[number];
export const isUiSetting = (v: unknown): v is UiSetting => UI_SETTINGS.includes(v as UiSetting);

export const UI_SETTING_LABEL: Record<UiSetting, string> = {
  graphical: "Graphical on top, text underneath",
  text: "Text only",
  graphical_only: "Graphical only (testing)",
};

export const UI_SETTING_HELP: Record<UiSetting, string> = {
  graphical: "Drawn shop, planning, day replay and market street; text for results, wallet and leaderboards. Players can pick Lite mode.",
  text: "Today's text screens everywhere. Graphics are never loaded.",
  graphical_only: "Like graphical, but no list view or Lite mode, to test the full graphical experience.",
};

export type UiMode = {
  /** What to draw. */
  view: "graphical" | "text";
  /** The setting in force for this viewer (the admin's preview, or the global one). */
  setting: UiSetting;
  global: UiSetting;
  /** The admin's preview, when one is set. */
  preview: UiSetting | null;
  /** Show the player's Lite mode toggle. */
  liteToggle: boolean;
  lite: boolean;
  /** Show "List view" next to the graphical market street. */
  listView: boolean;
};

/**
 * Which mode wins: 1. an admin's preview cookie; 2. global "text"; 3. global "graphical_only";
 * 4. global "graphical": text if the player turned on Lite mode or the browser asks to save data, else graphical.
 */
export function resolveUiMode(i: { global: UiSetting; preview: UiSetting | null; isAdmin: boolean; lite: boolean; saveData: boolean }): UiMode {
  const preview = i.isAdmin ? i.preview : null;
  const setting = preview ?? i.global;
  let view: UiMode["view"];
  if (preview) view = preview === "text" ? "text" : "graphical";
  else if (setting === "text") view = "text";
  else if (setting === "graphical_only") view = "graphical";
  else view = i.lite || i.saveData ? "text" : "graphical";
  return {
    view,
    setting,
    global: i.global,
    preview,
    liteToggle: setting === "graphical",
    lite: i.lite,
    listView: setting !== "graphical_only",
  };
}
