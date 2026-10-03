// Kopamate service worker, tuned for slow and expensive mobile data:
// - Offline page when the network drops.
// - Files that never change once published (hashed JS/CSS/fonts under /_next/static, avatars with
//   ?v=<version>, app icons) are served from this cache first, so repeat visits don't download them
//   again even when the phone's small browser cache has thrown them out.
// Pages and data always come from the network, so nobody sees someone else's or stale data.
// Also shows push notifications.
const VERSION = "v2";
const PAGES = `kopamate-pages-${VERSION}`;
const STATIC = `kopamate-static-${VERSION}`;
const AVATARS = `kopamate-avatars-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const LIMITS = { [STATIC]: 120, [AVATARS]: 200 };

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keep = [PAGES, STATIC, AVATARS];
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

/** Drops the oldest entries once a cache holds more than its limit (old deploys' files, old photos). */
async function trim(name) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  const extra = keys.length - LIMITS[name];
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
    trim(name);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }
  // Avatar URLs change whenever the photo changes (?v=), so a cached copy is always current.
  if (url.pathname.startsWith("/api/avatar/") && url.searchParams.has("v")) {
    event.respondWith(cacheFirst(request, AVATARS));
  }
});

// Push notifications (lib/push.ts sends { title, body, url, tag }).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Kopamate", {
      body: data.body || "",
      icon: "/icons/192",
      badge: "/icons/192",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/home" },
    }),
  );
});

// Tapping a notification focuses an open Kopamate tab (moving it to the page) or opens a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/home", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => new URL(c.url).origin === self.location.origin);
      // navigate() fails for a tab this worker doesn't control yet; open a fresh one then.
      if (open) return open.focus().then((c) => c.navigate(url)).catch(() => self.clients.openWindow(url));
      return self.clients.openWindow(url);
    }),
  );
});
