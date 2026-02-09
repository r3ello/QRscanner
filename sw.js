/* Door Scanner PWA — Service Worker
 *
 * Strategy:
 *  - Static app-shell assets: cache-first (install-time pre-cache)
 *  - API calls (/api/*):      network-only (never cache)
 *  - Everything else:          network-first, fallback to cache
 *
 * Bump CACHE_VERSION when deploying updates so the old cache is purged.
 */

const CACHE_VERSION = "door-scanner-v1";

const STATIC_ASSETS = [
    "./",
    "./index.html",
    "./app.js",
    "./styles.css",
    "./manifest.webmanifest",
    "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js",
];

// ── Install: pre-cache static assets ────────────
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(CACHE_VERSION)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// ── Activate: purge old caches ──────────────────
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((k) => k !== CACHE_VERSION)
                        .map((k) => caches.delete(k))
                )
            )
            .then(() => self.clients.claim())
    );
});

// ── Fetch: serve from cache, skip API calls ─────
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Never cache API requests — they must always hit the server
    if (url.pathname.startsWith("/api/")) return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request);
        })
    );
});
