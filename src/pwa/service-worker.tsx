"use client";

import { useEffect } from "react";

// Registered in production only: a service worker in development serves stale
// builds and hides hot reloads.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => {
        console.error("Service worker registration failed", error);
      });
  }, []);

  return null;
}
