// Content Security Policy, built per request with a fresh nonce. Next.js reads
// the nonce from the request's CSP header and stamps it on its own scripts,
// so every page must be rendered dynamically (see app/layout.tsx).

import { DATA_ORIGIN } from "@/bulletin/source";

const turnstileOrigin = "https://challenges.cloudflare.com";
const googleAccountsOrigin = "https://accounts.google.com";

export function createNonce(): string {
  return btoa(crypto.randomUUID());
}

export function buildCsp(options: {
  nonce: string;
  isDev: boolean;
  supabaseUrl: string;
  siteUrl: string;
}): string {
  const { nonce, isDev } = options;
  const supabaseOrigin = new URL(options.supabaseUrl).origin;

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // strict-dynamic lets nonce'd scripts (Turnstile's loader) pull in their
    // own dependencies, and makes browsers ignore host allowlists here.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": isDev
      ? ["'self'", "'unsafe-inline'"]
      : ["'self'", `'nonce-${nonce}'`],
    // React renders style={{...}} as HTML attributes. Style attributes cannot
    // run script, so allowing them inline keeps scripts strict.
    "style-src-attr": ["'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:"],
    "font-src": ["'self'"],
    // The public data Worker: bulletin.json and crowd.json (src/bulletin).
    "connect-src": ["'self'", DATA_ORIGIN],
    "frame-src": [turnstileOrigin],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // Sign-in posts to our own server, which redirects through Supabase to
    // Google; browsers check every hop of a form's redirect chain.
    "form-action": ["'self'", supabaseOrigin, googleAccountsOrigin],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(
    ([name, values]) => `${name} ${values.join(" ")}`,
  );
  // Only meaningful on HTTPS; on plain-http localhost it would break assets.
  if (new URL(options.siteUrl).protocol === "https:")
    policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
