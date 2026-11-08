"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      for (const registration of registrations) {
        const worker = registration.active;
        if (worker && new URL(worker.scriptURL).pathname === "/sw.js") {
          worker.postMessage({ type: "preview-session-clear" });
          await registration.unregister();
        }
      }
    }).catch(() => undefined);
  }, []);
  return null;
}
