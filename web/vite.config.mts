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
const web = fileURLToPath(new URL("./src", import.meta.url));

/**
 * Server modules that shared client components import, swapped for browser
 * versions with the same exports. Server Actions become calls straight to
 * the database (web/src/actions), and the bulletin hook reads it from there.
 */
const browserVersions: Record<string, string> = {
  "@/attendance/actions": `${web}/actions/attendance.ts`,
  "@/auth/sign-in-actions": `${web}/actions/sign-in.ts`,
  "@/auth/team-actions": `${web}/actions/team.ts`,
  "@/bulletin/actions": `${web}/actions/bulletin.ts`,
  "@/bulletin/use-bulletin": `${shims}/use-bulletin.ts`,
  "@/members/actions": `${web}/actions/members.ts`,
  "@/members/claim-actions": `${web}/actions/claim.ts`,
  "@/notifications/actions": `${web}/actions/notifications.ts`,
  "@/payments/actions": `${web}/actions/payments.ts`,
};

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
    "/sw.js",
    "  Cache-Control: no-cache",
    // Only the public site belongs in search results.
    ...["/app/*", "/sign-in", "/auth/*", "/claim/*", "/desk/*"].flatMap(
      (path) => [path, "  X-Robots-Tag: noindex"],
    ),
    "",
  ].join("\n");
  return {
    name: "iron-paradise:headers",
    generateBundle() {
      // The server-side prerender build (web/prerender.mjs) needs neither.
      if (this.environment.config.build.ssr) return;
      this.emitFile({ type: "asset", fileName: "_headers", source: headers });
      // Read by index.html before the page draws (see the comment there).
      this.emitFile({
        type: "asset",
        fileName: "boot.js",
        source: "document.documentElement.dataset.path = location.pathname;\n",
      });
    },
  };
}

/**
 * Fails the build when a server-only module (database client, secrets) is
 * pulled into the browser bundle, naming the file that imported it.
 */
function noServerCode(): Plugin {
  const forbidden = new Set(["server-only", "postgres", "drizzle-orm"]);
  return {
    name: "iron-paradise:no-server-code",
    enforce: "pre",
    resolveId(id, importer) {
      const name = id.startsWith("drizzle-orm") ? "drizzle-orm" : id;
      if (forbidden.has(name)) {
        this.error(
          `${importer ?? "?"} imports ${id}, which is server code. Give the static app its own version (web/src) or import types only.`,
        );
      }
      return null;
    },
  };
}

export default defineConfig(({ mode }) => {
  // Same .env.local as the Next.js app, so both talk to the same project.
  const env = loadEnv(mode, root, "NEXT_PUBLIC_");
  // The VAPID public key is public by design (browsers need it to subscribe
  // to push); only the private half stays secret, in the Edge Functions.
  const vapidPublicKey =
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
    loadEnv(mode, root, "VAPID_").VAPID_PUBLIC_KEY ??
    "";
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
    define: {
      ...Object.fromEntries(
        required.map((name) => [
          `process.env.${name}`,
          JSON.stringify(env[name]),
        ]),
      ),
      "process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY":
        JSON.stringify(vapidPublicKey),
      "process.env.NEXT_PUBLIC_EMAIL_REMINDERS": JSON.stringify(
        env.NEXT_PUBLIC_EMAIL_REMINDERS ?? "",
      ),
    },
    resolve: {
      alias: [
        ...Object.entries(browserVersions).map(([module, replacement]) => ({
          // A string matches the exact module id (or a path under it).
          find: module,
          replacement,
        })),
        { find: /^next\/link$/, replacement: `${shims}/next-link.tsx` },
        {
          find: /^next\/navigation$/,
          replacement: `${shims}/next-navigation.ts`,
        },
        { find: /^@\//, replacement: `${src}/` },
      ],
    },
    plugins: [
      noServerCode(),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
      securityHeaders(env.NEXT_PUBLIC_SUPABASE_URL),
    ],
    server: { port: 5173, strictPort: true },
    build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
  };
});
