import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { sql } from "../db";
import { isAdmin, type User } from "../session";
import { isUiSetting, resolveUiMode, type UiMode, type UiSetting } from "./ui-rules";

/** An admin's own "Preview as" choice. Never read for anyone else. */
export const PREVIEW_COOKIE = "km_hustle_preview";

export async function getGlobalUiSetting(): Promise<UiSetting> {
  const [row] = await sql<{ value: string }[]>`SELECT value FROM settings WHERE key = 'hustle_ui_mode'`;
  return isUiSetting(row?.value) ? row.value : "graphical";
}

/** The display mode for this user on this request (see resolveUiMode for the order of the rules). */
export const getHustleUiMode = cache(async (user: Pick<User, "id" | "email" | "whatsapp_e164">): Promise<UiMode> => {
  const admin = isAdmin(user);
  const [global, [row], jar, h] = await Promise.all([
    getGlobalUiSetting(),
    sql<{ lite: boolean }[]>`SELECT hustle_lite AS lite FROM users WHERE id = ${user.id}`,
    cookies(),
    headers(),
  ]);
  const raw = jar.get(PREVIEW_COOKIE)?.value;
  return resolveUiMode({
    global,
    preview: admin && isUiSetting(raw) ? raw : null,
    isAdmin: admin,
    lite: Boolean(row?.lite),
    saveData: h.get("save-data")?.toLowerCase() === "on",
  });
});
