import "server-only";
import { sql } from "../db";
import { isAdmin, type User } from "../session";
import type { HustleSettings } from "./settings";

/** Whether My Hustle is switched on for this user (the hustle_enabled flag: off, admins only, or everyone). */
export function hustleOpenTo(user: Pick<User, "email" | "whatsapp_e164">, enabled: HustleSettings["enabled"]) {
  if (enabled === "all") return true;
  if (enabled === "admins") return isAdmin(user);
  return false;
}

export async function hustleEnabledFor(user: Pick<User, "email" | "whatsapp_e164">) {
  const [row] = await sql<{ value: string }[]>`SELECT value FROM settings WHERE key = 'hustle_enabled'`;
  const enabled = (row?.value ?? "admins") as HustleSettings["enabled"];
  return hustleOpenTo(user, enabled);
}
