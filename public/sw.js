// Retirement worker: remove the legacy preview token cache and fetch interceptor.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await caches.delete("reppilot-preview-session");
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
