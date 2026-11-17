/// <reference lib="webworker" />
import type {
  PrecacheEntry,
  RuntimeCaching,
  SerwistGlobalConfig,
} from "serwist";
import {
  CacheFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";
import { createRequestBuffer } from "./request-buffer";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Only public, versioned assets are cached. Pages and data are never stored
// on the device: a shared desk tablet must not keep one person's member list
// or payments around for the next person. Offline, pages show /~offline.
//
// The one exception is the gym's public bulletin and crowd files, read from
// the iron-paradise-data Worker (src/bulletin/source.ts). They hold nothing
// personal, so the last copy is shown at once and offline while a fresh one
// loads behind it (stale-while-revalidate).
const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ url, sameOrigin }) =>
      !sameOrigin &&
      url.hostname.startsWith("iron-paradise-data.") &&
      (url.pathname === "/bulletin.json" || url.pathname === "/crowd.json"),
    handler: new StaleWhileRevalidate({ cacheName: "public-data" }),
  },
  {
    matcher: ({ url, sameOrigin }) =>
      sameOrigin && url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({ cacheName: "next-static" }),
  },
  {
    matcher: ({ request, sameOrigin }) =>
      sameOrigin &&
      (request.destination === "image" || request.destination === "font"),
    handler: new StaleWhileRevalidate({ cacheName: "public-media" }),
  },
  {
    // Pages and their data: through the request buffer, never cached.
    matcher: ({ request, sameOrigin }) =>
      sameOrigin && request.method === "GET",
    handler: ({ request, event }) => sendToServer(request, event),
  },
  {
    // Saves (Server Actions, uploads) and other sites go straight out. A
    // save is never repeated here: if the server cut it off it may already
    // have happened, and a second try could record a payment twice.
    matcher: () => true,
    handler: new NetworkOnly(),
  },
];

const buffer = createRequestBuffer({
  maxInFlight: 2,
  retryDelaysMs: [1000, 3000],
});

function sendToServer(request: Request, event: ExtendableEvent) {
  // Next.js marks its guesses about the next page with these headers.
  const prefetch =
    request.headers.has("next-router-prefetch") ||
    request.headers.has("next-router-segment-prefetch");
  return buffer.send(
    async (attempt) => {
      // The browser starts a page load before this worker wakes up
      // (navigation preload). Use that first answer instead of asking twice.
      if (attempt === 0 && request.mode === "navigate") {
        const preloaded = await (event as FetchEvent).preloadResponse;
        if (preloaded) return preloaded;
      }
      return fetch(request.clone());
    },
    // A failed prefetch costs nothing, so it isn't worth a retry.
    { background: prefetch, retry: !prefetch },
  );
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

// Fee reminders (src/notifications). The server encrypts a small JSON
// message to this browser; the push service can't read it.
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
