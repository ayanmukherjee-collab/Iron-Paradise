"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const dismissKey = "ip-install-guide-dismissed";

type Platform = "server" | "installed" | "ios" | "other";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

function detectPlatform(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  // iPadOS reports itself as a Mac, so also check for a touch screen.
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "other";
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(dismissKey) === "1";
  } catch {
    return false;
  }
}

const noSubscription = () => () => {};

/**
 * Explains how to put the app on the home screen. iOS has no install prompt:
 * Safari only installs through Share → Add to Home Screen, and push
 * notifications only work after that. Other browsers get a one-tap button
 * when they offer one.
 */
export function InstallGuide() {
  const platform = useSyncExternalStore(
    noSubscription,
    detectPlatform,
    () => "server" as const,
  );
  const storedDismissal = useSyncExternalStore(
    noSubscription,
    readDismissed,
    () => true,
  );
  const [dismissed, setDismissed] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    function capture(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {
      // Private browsing can block storage; the guide just comes back next visit.
    }
  }

  if (
    dismissed ||
    storedDismissal ||
    platform === "server" ||
    platform === "installed"
  )
    return null;
  if (platform === "other" && !installPrompt) return null;

  return (
    <aside
      className="mx-4 rounded-card bg-white px-5 py-5 shadow-float"
      aria-label="Install the app"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {platform === "ios" ? (
          <p className="max-w-prose">
            <strong>Add this app to your home screen.</strong> In Safari, tap
            the Share button (the square with an arrow), then{" "}
            <strong>Add to Home Screen</strong>. Payment reminders can only
            reach you once it&apos;s there.
          </p>
        ) : (
          <p className="max-w-prose">
            <strong>Install the app</strong> for one-tap check-in and payment
            reminders.
          </p>
        )}
        <div className="flex shrink-0 gap-3">
          {platform === "other" && installPrompt && (
            <Button
              variant="dark"
              onClick={async () => {
                await installPrompt.prompt();
                setInstallPrompt(null);
              }}
            >
              Install
            </Button>
          )}
          <Button variant="outline-dark" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
    </aside>
  );
}
