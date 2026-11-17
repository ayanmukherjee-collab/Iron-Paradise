"use client";

import { useEffect, useState } from "react";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { Button } from "@/components/ui/button";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestNotification,
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
  "not-ready": "Open the installed app to turn on notifications.",
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

/** Whether a subscription was made with this app's current public key. */
function sameKey(subscription: PushSubscription, vapidPublicKey: string) {
  const used = subscription.options.applicationServerKey;
  if (!used) return true;
  const wanted = keyBytes(vapidPublicKey);
  const bytes = new Uint8Array(used);
  return (
    bytes.length === wanted.length &&
    bytes.every((byte, index) => byte === wanted[index])
  );
}

function toSaved(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  };
}

/**
 * Turns push notifications on or off on the phone being used, and sends a
 * test so anyone can check they arrive.
 */
export function PushToggle({
  vapidPublicKey,
  compact = false,
}: {
  vapidPublicKey: string;
  /** One row with a switch, for a small card. */
  compact?: boolean;
}) {
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
      let subscription = await worker.pushManager.getSubscription();
      if (!subscription) return "off";
      // Made with an older key pair (the keys were replaced on 2026-11-17)?
      // Push services refuse those, so swap it for one made with the
      // current key. Permission is already granted, so nothing is asked.
      if (!sameKey(subscription, vapidPublicKey)) {
        await subscription.unsubscribe();
        subscription = await worker.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(vapidPublicKey),
        });
      }
      // Someone else may have used this phone since; reminders sent here
      // should go to whoever is signed in now.
      void savePushSubscription(toSaved(subscription));
      return "on";
    }
    check()
      .catch((): State => "off")
      .then((next) => !cancelled && setState(next));
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

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
      setMessage("Couldn't turn on notifications here. Try again.");
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
      setMessage("Notifications are off for this phone.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await sendTestNotification({});
      setMessage(result.ok ? result.data.message : result.error);
    } catch {
      setMessage("Couldn't send the test. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") return compact ? <span className="flex-1" /> : null;

  if (compact) {
    const on = state === "on";
    return (
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Notifications</span>
          {!explanations[state] && (
            <span className="flex items-center gap-2">
              {on && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={sendTest}
                  aria-label="Send a test notification"
                  title="Send a test"
                  className="flex size-9 items-center justify-center rounded-control bg-canvas transition-colors hover:bg-ink hover:text-white disabled:opacity-50"
                >
                  <NavIconSvg icon="arrow" className="size-4" />
                </button>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label="Notifications on this phone"
                disabled={busy}
                onClick={on ? turnOff : turnOn}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-ink" : "bg-ink/15"}`}
              >
                <span
                  className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow-card transition-transform ${on ? "translate-x-5" : ""}`}
                />
              </button>
            </span>
          )}
        </div>
        {(explanations[state] || message) && (
          <p role="status" className="mt-1 text-xs text-muted">
            {explanations[state] ?? message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      {explanations[state] ? (
        <p className="text-muted">{explanations[state]}</p>
      ) : state === "on" ? (
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy} onClick={sendTest}>
            Send test
          </Button>
          <Button variant="outline-dark" disabled={busy} onClick={turnOff}>
            Turn off
          </Button>
        </div>
      ) : (
        <Button disabled={busy} onClick={turnOn}>
          {busy ? "Turning on…" : "Turn on"}
        </Button>
      )}
      {message && (
        <p role="status" className="mt-3 callout">
          {message}
        </p>
      )}
    </div>
  );
}
