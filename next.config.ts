import type { NextConfig } from "next";

// The Content-Security-Policy is set per request in src/proxy.ts because it
// carries a nonce. Everything static lives here.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera stays available to our own pages for QR check-in and slip photos.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Other sites may not embed our responses (pages, exports, images).
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

const nextConfig: NextConfig = {
  // Cache Components is off: its prerendered static shell cannot carry a
  // per-request CSP nonce, and the strict CSP is a hard requirement.
  reactCompiler: true,
  poweredByHeader: false,
  experimental: {
    // Keep pages the person has just seen in the browser's memory for 30s,
    // so flicking between tabs is instant instead of a server round trip
    // each time. Every Server Action that changes data calls revalidatePath,
    // which clears this cache, and so does signing out. Memory only: nothing
    // is written to the device.
    staleTimes: { dynamic: 30 },
  },
  // Lets a phone on the same Wi-Fi open the dev server by its LAN address
  // (e.g. http://10.32.243.57:3000). Development only; production ignores it.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
