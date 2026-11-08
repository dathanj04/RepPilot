const SESSION_CACHE = "reppilot-preview-session";
let previewToken = "";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    previewToken = "";
    await caches.delete(SESSION_CACHE);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "preview-session" && typeof data.token === "string") {
    previewToken = data.token;
  }
  if (data.type === "preview-session-clear") {
    previewToken = "";
    event.waitUntil(caches.delete(SESSION_CACHE));
  }
});

// Cursor's preview ingress drops Cookie on the way to the app and forwards
// Authorization. The page reads the preview seal and asks us to attach it.
// Do not cache POST bodies or treat an offline note as synced.
self.addEventListener("fetch", (event) => {
  if (!previewToken) return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/_next/image") || url.pathname === "/sw.js") return;
  event.respondWith(withPreviewSession(event.request));
});

async function withPreviewSession(request) {
  const token = previewToken;
  if (!token || request.headers.get("authorization")) return fetch(request);
  const headers = new Headers(request.headers);
  headers.set("authorization", `Bearer ${token}`);
  try {
    return await fetch(new Request(request, { headers }));
  } catch {
    return fetch(request.url, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.blob(),
      credentials: "include",
      redirect: request.redirect,
    });
  }
}

