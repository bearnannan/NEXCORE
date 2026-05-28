const CACHE_NAME = "mission-control-cache-v1";
const STATIC_ASSETS = [
  "/mission-control",
  "/manifest.json",
  "/favicon.ico"
];

// Install Event - Pre-cache critical dashboard shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching static dashboard shell");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Clearing old cache store");
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Handle requests with stale-while-revalidate and network-first
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // We only intercept GET requests
  if (req.method !== "GET") return;

  // Avoid caching Next.js Hot Module Replacement or chrome extensions
  if (req.url.includes("/_next/webpack-hmr") || req.url.startsWith("chrome-extension://")) {
    return;
  }

  // Avoid caching Auth.js endpoints or API calls, as those are handled by react-query and our IndexedDB sync
  if (req.url.includes("/api/auth/") || req.url.includes("/api/stations") || req.url.includes("/api/incidents")) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(req).then((cachedResponse) => {
        const fetchedResponse = fetch(req)
          .then((networkResponse) => {
            // Cache valid responses for static assets
            if (networkResponse.status === 200) {
              cache.put(req, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Silent error on fetch fail (offline)
            return cachedResponse;
          });

        // Return cached response instantly if exists, otherwise wait for network
        return cachedResponse || fetchedResponse;
      });
    })
  );
});
