"use client";

import { removePushSubscription, savePushSubscription } from "@/app/actions/push";

/**
 * Push notifications in the browser.
 * "ios-install": iPhones only allow web push once Kopamate is added to the Home Screen.
 * The service worker is only registered in production, so in dev this reports "unsupported".
 */
export type PushSupport = "ok" | "ios-install" | "unsupported";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (process.env.NODE_ENV !== "production") return "unsupported";
  return "ok";
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.register("/sw.js");
}

function keyBytes(base64url: string) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function currentSubscription() {
  if (pushSupport() !== "ok") return null;
  return (await registration()).pushManager.getSubscription();
}

/** Asks for permission if needed, subscribes this browser and saves it. */
export async function enablePush(publicKey: string): Promise<"on" | "denied" | "error"> {
  try {
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") return "denied";
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
    const res = await savePushSubscription(sub.toJSON() as Parameters<typeof savePushSubscription>[0]);
    return "error" in res ? "error" : "on";
  } catch {
    return "error";
  }
}

export async function disablePush() {
  const sub = await currentSubscription().catch(() => null);
  if (!sub) return;
  await removePushSubscription(sub.endpoint).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
