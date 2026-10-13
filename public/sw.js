self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Do not cache POST requests or pretend offline records have synced.
self.addEventListener("fetch", () => {});
