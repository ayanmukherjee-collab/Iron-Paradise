"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

interface TurnstileApi {
  render(
    element: HTMLElement,
    options: { sitekey: string; theme: "dark" | "light" },
  ): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Cloudflare's bot check. Rendered explicitly (not by the script scanning the
 * page) so it survives client-side navigation. The widget adds a hidden
 * `cf-turnstile-response` field to the surrounding form. Remount it (change
 * its key) after a failed submit, because each token works only once.
 */
export function Turnstile({
  siteKey,
  nonce,
}: {
  siteKey: string;
  nonce?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded || !container.current || !window.turnstile) return;
    const widgetId = window.turnstile.render(container.current, {
      sitekey: siteKey,
      theme: "dark",
    });
    return () => window.turnstile?.remove(widgetId);
  }, [loaded, siteKey]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        nonce={nonce}
        onReady={() => setLoaded(true)}
      />
      <div ref={container} className="min-h-[65px]" />
    </>
  );
}
