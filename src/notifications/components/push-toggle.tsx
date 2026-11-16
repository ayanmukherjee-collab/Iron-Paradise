"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  removePushSubscription,
  savePushSubscription,
} from "@/notifications/actions";

type State =
  | "checking"
  | "unsupported"
  | "install-first"
  | "not-ready"
  | "blocked"
  | "off"
  | "on";

const explanations: Partial<Record<State, string>> = {
  unsupported: "This browser can't show notifications.",
  "install-first":
    "On iPhone, add the app to your Home Screen first (Share, then Add to Home Screen), then open it from there.",
  "not-ready": "Open the installed app to turn on reminders.",
  blocked:
    "Notifications are blocked for this site. Allow them in your browser's site settings, then come back.",
};

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isInstalled(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  return (await navigator.serviceWorker.getRegistration("/")) ?? null;
}

function toSaved(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  };
}

/** Lets a member turn fee reminders on or off on the phone they're using. */
export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check(): Promise<State> {
      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!supported)
        return isIos() && !isInstalled() ? "install-first" : "unsupported";
      if (Notification.permission === "denied") return "blocked";
      const worker = await registration();
      if (!worker) return "not-ready";
      const subscription = await worker.pushManager.getSubscription();
      if (!subscription) return "off";
      // Someone else may have used this phone since; reminders sent here
      // should go to whoever is signed in now.
      void savePushSubscription(toSaved(subscription));
      return "on";
    }
    check().then((next) => !cancelled && setState(next));
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const worker = await registration();
      if (!worker) return setState("not-ready");
      const subscription = await worker.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(vapidPublicKey),
      });
      const result = await savePushSubscription(toSaved(subscription));
      if (result.ok) {
        setState("on");
        setMessage(result.data.message);
      } else {
        await subscription.unsubscribe();
        setMessage(result.error);
      }
    } catch {
      setMessage("Couldn't turn on reminders here. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    try {
      const subscription = await (
        await registration()
      )?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setState("off");
      setMessage("Reminders are off for this phone.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") return null;

  return (
    <div>
      {explanations[state] ? (
        <p className="text-smoke">{explanations[state]}</p>
      ) : state === "on" ? (
        <Button variant="outline-dark" disabled={busy} onClick={turnOff}>
          {busy ? "Turning off…" : "Turn off reminders on this phone"}
        </Button>
      ) : (
        <Button disabled={busy} onClick={turnOn}>
          {busy ? "Turning on…" : "Turn on reminders on this phone"}
        </Button>
      )}
      {message && (
        <p role="status" className="mt-3 border-l-4 border-ink pl-3">
          {message}
        </p>
      )}
    </div>
  );
}
