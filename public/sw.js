const VERSION = "v1";
const STATIC_CACHE = `wc26-static-${VERSION}`;
const IMAGE_CACHE = `wc26-images-${VERSION}`;
const OFFLINE_URL = "/offline";
const MAX_IMAGE_ENTRIES = 150;

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Origin auth/database Firebase tidak boleh di-intercept sama sekali:
// popup login dan WebChannel Firestore rusak kalau responsnya lewat SW.
const BYPASS_HOSTS = [
  "googleapis.com",
  "firebaseapp.com",
  "firebaseio.com",
  "gstatic.com",
  "google.com",
  "accounts.google.com",
];

const IMAGE_HOSTS = [
  "flagcdn.com",
  "crests.football-data.org",
  "media.api-sports.io",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

function hostMatches(hostname, hosts) {
  return hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    await cache.put(request, response.clone());
    if (maxEntries) trimCache(cache, maxEntries);
  }
  return response;
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length > maxEntries) await cache.delete(keys[0]);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (hostMatches(url.hostname, BYPASS_HOSTS)) return;

  // Payload RSC (AutoRefresh / navigasi client) berbagi URL dengan HTML —
  // jangan pernah di-cache atau diberi fallback, biarkan network-only.
  if (request.headers.get("RSC") || request.headers.get("Next-Router-Prefetch"))
    return;

  // Navigasi HTML: skor live harus selalu dari network; offline → fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  if (url.origin === self.location.origin) {
    if (
      url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/")
    ) {
      event.respondWith(cacheFirst(request, STATIC_CACHE));
    }
    return;
  }

  if (request.destination === "image" && hostMatches(url.hostname, IMAGE_HOSTS)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_ENTRIES));
  }
});
