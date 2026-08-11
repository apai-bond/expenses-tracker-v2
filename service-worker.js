"use strict";

const CACHE_NAME = "pocket-budget-v27-ios-backup-import-r3";
const LOCAL_ASSETS = [
  "./",
  "index.html",
  "styles.css?v=27",
  "cycle.js?v=27",
  "db.js?v=27",
  "backup-crypto.js?v=27",
  "app.js?v=27",
  "calculations.py?v=27",
  "manifest.webmanifest?v=27",
  "icons/icon-192.png?v=27",
  "icons/icon-512.png?v=27",
  "icons/icon-1024.png?v=27",
  "icons/apple-touch-icon.png?v=27",
  "icons/favicon.svg?v=27",
  "icons/app-icon.svg?v=27"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(LOCAL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, navigationFallback = false) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.status === 200 && response.type === "basic") {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (navigationFallback) {
      const fallback = await caches.match("index.html");
      if (fallback) return fallback;
    }
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(networkFirst(event.request, event.request.mode === "navigate"));
});
