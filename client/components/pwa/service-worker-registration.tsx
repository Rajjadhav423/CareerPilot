"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js (offline page only) in production builds. Skipped in `pnpm dev` so a worker
 * never interferes with hot reload.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not fatal: the app works the same without it, just without the offline page
    });
  }, []);

  return null;
}
