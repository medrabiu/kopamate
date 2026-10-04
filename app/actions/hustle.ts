"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { getDay, startBusiness } from "@/lib/hustle/business";
import { getBusinessByOwner } from "@/lib/hustle/data";
import { openDay } from "@/lib/hustle/day";
import { hustleEnabledFor } from "@/lib/hustle/access";
import { getVibe, isNeed } from "@/lib/hustle/needs";
import { buyBackup, buyFromListing, submitReview } from "@/lib/hustle/trade";
import { lagosDayStart, transfer } from "@/lib/hustle/wallet";
import { PREVIEW_COOKIE } from "@/lib/hustle/ui-mode";
import { isUiSetting } from "@/lib/hustle/ui-rules";
import { sql } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { track } from "@/lib/stats";

async function player() {
  const user = await getCurrentUser();
  if (!user?.completed_at) return null;
  if (!(await hustleEnabledFor(user))) return null;
  return user;
}

export type StartState = { error?: string; slug?: string };

export async function startHustle(_prev: StartState, fd: FormData): Promise<StartState> {
  const user = await player();
  if (!user) return { error: "My Hustle isn't open yet." };
  const result = await startBusiness(user.id, user.state, {
    type: String(fd.get("type") ?? ""),
    name: String(fd.get("name") ?? ""),
    icon: String(fd.get("icon") ?? ""),
    color: String(fd.get("color") ?? ""),
  });
  if ("error" in result) return { error: result.error };
  await track("hustle_started", user.id, { type: String(fd.get("type")) });
  revalidatePath("/hustle");
  revalidatePath("/home");
  return { slug: result.slug };
}

export async function openShop(plan: { units: number; price: number; card: number | null; choice: number | null }) {
  const user = await player();
  if (!user) return { error: "My Hustle isn't open yet." };
  const result = await openDay(user.id, {
    units: Number(plan.units),
    price: Number(plan.price),
    card: plan.card === null ? null : Number(plan.card),
    choice: plan.choice === null ? null : Number(plan.choice),
  });
  if (!("ok" in result)) return result;
  await track("hustle_opened", user.id);
  // No revalidatePath here: it would re-render the plan page mid-replay (and send it to the day page).
  // Both plan screens refresh the router themselves when the player moves on.
  // The day exactly as the server played it, for the graphical replay (decoration only: it never changes numbers).
  const b = (await getBusinessByOwner(sql, user.id))!;
  const [day, buyers] = await Promise.all([
    getDay(sql, b.id, result.date),
    sql<{ nickname: string }[]>`
      SELECT DISTINCT u.nickname FROM hustle_orders o JOIN users u ON u.id = o.buyer_user_id
      WHERE o.seller_business_id = ${b.id} AND o.created_at >= ${lagosDayStart(result.date)} AND o.status = 'done' LIMIT 3
    `,
  ]);
  return { ok: true as const, date: result.date, day: day!, rating: b.rating, buyers: buyers.map((r) => r.nickname) };
}

export async function moveMoney(direction: "invest" | "draw", amount: number) {
  const user = await player();
  if (!user) return { error: "My Hustle isn't open yet." };
  if (direction !== "invest" && direction !== "draw") return { error: "Try again." };
  const result = await transfer(user.id, direction, Math.round(Number(amount)));
  if ("ok" in result) {
    revalidatePath("/hustle");
    revalidatePath("/hustle/wallet");
  }
  return result;
}

/** Buys from a player's shop today (a need from your wallet, or supplies and services from your business). */
export async function buy(listingId: number, qty: number) {
  const user = await player();
  if (!user) return { error: "My Hustle isn't open yet." };
  const before = await getVibe(sql, user.id);
  const result = await buyFromListing(user, Math.round(Number(listingId)), Math.round(Number(qty)));
  if (!("ok" in result)) return result;
  await track("hustle_bought", user.id);
  revalidatePath("/hustle", "layout");
  return { ...result, vibeBefore: before, vibeAfter: await getVibe(sql, user.id) };
}

/** The backup shop, for a need nobody in your state sells today. */
export async function buyFromBackup(need: string) {
  const user = await player();
  if (!user) return { error: "My Hustle isn't open yet." };
  if (!isNeed(need)) return { error: "Pick a need." };
  const result = await buyBackup(user, need);
  if ("ok" in result) revalidatePath("/hustle", "layout");
  return result;
}

export async function review(orderId: number, stars: number, text: string) {
  const user = await player();
  if (!user) return { error: "My Hustle isn't open yet." };
  const result = await submitReview(user.id, Math.round(Number(orderId)), Math.round(Number(stars)), String(text ?? ""));
  if ("ok" in result) {
    revalidateTag("hustle");
    revalidatePath("/hustle", "layout");
  }
  return result;
}

/** Admins only: view My Hustle in another display mode, on this device only. null goes back to the global setting. */
export async function setHustlePreview(mode: string | null) {
  const user = await player();
  if (!user || !isAdmin(user)) return { error: "Admins only." };
  const jar = await cookies();
  if (mode === null) jar.delete(PREVIEW_COOKIE);
  else if (isUiSetting(mode)) jar.set(PREVIEW_COOKIE, mode, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax", httpOnly: true });
  else return { error: "Pick a mode." };
  revalidatePath("/hustle", "layout");
  return { ok: true as const };
}

/** A player's Lite mode: the simpler text screens (only offered when the global mode is "graphical"). */
export async function setLiteMode(on: boolean) {
  const user = await player();
  if (!user) return { error: "My Hustle isn't open yet." };
  await sql`UPDATE users SET hustle_lite = ${Boolean(on)} WHERE id = ${user.id}`;
  revalidatePath("/hustle", "layout");
  return { ok: true as const };
}
