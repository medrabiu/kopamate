"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { startBusiness } from "@/lib/hustle/business";
import { openDay } from "@/lib/hustle/day";
import { hustleEnabledFor } from "@/lib/hustle/access";
import { isNeed } from "@/lib/hustle/needs";
import { buyBackup, buyFromListing, submitReview } from "@/lib/hustle/trade";
import { transfer } from "@/lib/hustle/wallet";
import { getCurrentUser } from "@/lib/session";
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
  if ("ok" in result) {
    await track("hustle_opened", user.id);
    revalidatePath("/hustle");
    revalidatePath("/home");
  }
  return result;
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
  const result = await buyFromListing(user, Math.round(Number(listingId)), Math.round(Number(qty)));
  if ("ok" in result) {
    await track("hustle_bought", user.id);
    revalidatePath("/hustle", "layout");
  }
  return result;
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
