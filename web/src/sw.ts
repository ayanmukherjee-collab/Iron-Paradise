/// <reference lib="webworker" />
// The static app's service worker (built by web/build-sw.mjs into
// web/dist/sw.js). Replaces src/pwa/sw.ts: there is no server to buffer or
// retry any more, so it only keeps the app working offline and shows push
// notifications.
//
// What is stored on the phone: the app's own files (the HTML shell, scripts,
// styles, fonts, images), which hold nothing personal. Member data from
// Supabase is never cached, so a shared desk tablet keeps nobody's list or
// payments for the next person.
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Every page is the same app shell; offline, the cached one opens.
      matcher: ({ request, sameOrigin }) =>
        sameOrigin && request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages",
        networkTimeoutSeconds: 4,
      }),
    },
    {
      // Built files have content hashes in their names, so never change.
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && url.pathname.startsWith("/assets/"),
      handler: new CacheFirst({ cacheName: "assets" }),
    },
    {
      matcher: ({ request, sameOrigin }) =>
        sameOrigin &&
        (request.destination === "image" || request.destination === "font"),
      handler: new StaleWhileRevalidate({ cacheName: "public-media" }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/index.html",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

// Fee reminders (supabase/functions/reminders). The sender encrypts a small
// JSON message to this browser; the push service can't read it.
interface ReminderPush {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

self.addEventListener("push", (event) => {
  let data: ReminderPush = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Iron Paradise", {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url ?? "/app" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data as { url?: string } | null)?.url ?? "/app",
    self.location.origin,
  );
  // Only ever open pages of this app.
  const url = target.origin === self.location.origin ? target.href : "/app";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const open = windows.find((client) =>
        client.url.startsWith(self.location.origin),
      );
      if (open) {
        await open.focus();
        await open.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
