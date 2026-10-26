"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function previewToken() {
  const prefix = "reppilot_preview=";
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return "";
}

export function ServiceWorkerRegister() {
  const pathname = usePathname();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const host = window.location.hostname;
    const previewHost = host.endsWith(".agent.cvm.dev") || host.endsWith(".cursorvm.com");
    if (!previewHost) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister();
      }).catch(() => undefined);
      return;
    }
    const token = previewToken();
    let cancelled = false;
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(async (registration) => {
      if (cancelled) return;
      const ready = await navigator.serviceWorker.ready;
      const message = token ? { type: "preview-session", token } : pathname === "/login" || pathname === "/signup" ? { type: "preview-session-clear" } : null;
      if (!message) return;
      ready.active?.postMessage(message);
      registration.waiting?.postMessage(message);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
