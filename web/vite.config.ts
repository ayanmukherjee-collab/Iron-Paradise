// The static app (docs/static-rebuild.md). Vite builds it into web/dist:
// plain files that Cloudflare serves as static assets, so no Worker runs.
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = fileURLToPath(new URL("../src", import.meta.url));
const shims = fileURLToPath(new URL("./src/shims", import.meta.url));

/**
 * The strict Content-Security-Policy, as a Cloudflare `_headers` file. Vite
 * emits no inline scripts, so `script-src 'self'` holds without a nonce (the
 * old app needed one per request, which forced every page through the
 * Worker). Supabase is the only other origin the app talks to.
 */
function securityHeaders(supabaseUrl: string): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabaseUrl} ${supabaseUrl.replace("https://", "wss://")}`,
    "media-src 'self' blob:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
  const headers = [
    "/*",
    `  Content-Security-Policy: ${csp}`,
    "  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload",
    "  X-Frame-Options: DENY",
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "  Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=()",
    "  Cross-Origin-Opener-Policy: same-origin",
    "  Cross-Origin-Resource-Policy: same-origin",
    "  X-Permitted-Cross-Domain-Policies: none",
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
  ].join("\n");
  return {
    name: "iron-paradise:headers",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "_headers", source: headers });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Same .env.local as the Next.js app, so both talk to the same project.
  const env = loadEnv(mode, root, "NEXT_PUBLIC_");
  const required = [
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ];
  for (const name of required) {
    if (!env[name]) throw new Error(`${name} is missing from .env.local`);
  }

  return {
    root: fileURLToPath(new URL(".", import.meta.url)),
    publicDir: fileURLToPath(new URL("../public", import.meta.url)),
    envDir: root,
    envPrefix: "NEXT_PUBLIC_",
    // Shared code reads process.env.NEXT_PUBLIC_*, as Next.js inlines them.
    define: Object.fromEntries(
      required.map((name) => [
        `process.env.${name}`,
        JSON.stringify(env[name]),
      ]),
    ),
    resolve: {
      alias: [
        { find: /^next\/link$/, replacement: `${shims}/next-link.tsx` },
        {
          find: /^next\/navigation$/,
          replacement: `${shims}/next-navigation.ts`,
        },
        // Shared modules mark themselves client-only or server-only for
        // Next.js. Server-only ones must never reach this bundle: the shim
        // throws if one does.
        { find: /^server-only$/, replacement: `${shims}/server-only.ts` },
        { find: /^@\//, replacement: `${src}/` },
      ],
    },
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
      securityHeaders(env.NEXT_PUBLIC_SUPABASE_URL),
    ],
    server: { port: 5173, strictPort: true },
    build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
  };
});
