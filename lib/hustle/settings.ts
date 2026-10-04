import "server-only";
import { sql } from "../db";

export type HustleSettings = {
  enabled: "off" | "admins" | "all";
  grant: number;
  allawee: number;
  taskCap: number;
  townMultiplier: number;
  backupMarkup: number;
  salvagePct: number;
  needVibeEffect: number;
  graceDays: number;
};

export const HUSTLE_SETTING_DEFAULTS: Record<string, string> = {
  hustle_enabled: "admins",
  hustle_grant: "50000",
  hustle_allawee: "20000",
  hustle_task_cap: "500",
  hustle_town_multiplier: "1.0",
  hustle_backup_markup: "0.25",
  hustle_salvage_pct: "0.7",
  hustle_need_vibe_effect: "0.05",
  hustle_grace_days: "7",
};

/** All hustle_* settings, with defaults for any that are missing. Cheap: one indexed query. */
export async function getHustleSettings(db = sql): Promise<HustleSettings> {
  const rows = await db<{ key: string; value: string }[]>`SELECT key, value FROM settings WHERE key LIKE 'hustle\_%'`;
  const v = { ...HUSTLE_SETTING_DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  const num = (k: string) => {
    const n = Number(v[k]);
    return Number.isFinite(n) ? n : Number(HUSTLE_SETTING_DEFAULTS[k]);
  };
  const enabled = v.hustle_enabled === "off" || v.hustle_enabled === "all" ? v.hustle_enabled : "admins";
  return {
    enabled,
    grant: num("hustle_grant"),
    allawee: num("hustle_allawee"),
    taskCap: num("hustle_task_cap"),
    townMultiplier: num("hustle_town_multiplier"),
    backupMarkup: num("hustle_backup_markup"),
    salvagePct: num("hustle_salvage_pct"),
    needVibeEffect: num("hustle_need_vibe_effect"),
    graceDays: num("hustle_grace_days"),
  };
}
