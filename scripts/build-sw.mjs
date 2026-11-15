// Compiles the service worker (src/pwa/sw.ts) to public/sw.js before every
// `next build`. It is a plain static file rather than a Next.js route so the
// bundler never ends up inside the Cloudflare Worker.
//
// The precache list holds only the offline page. Its revision changes every
// build so phones pick up a new offline page after a deploy.

import { randomUUID } from "node:crypto";
import { build } from "esbuild";

const revision = process.env.GITHUB_SHA ?? randomUUID();
const precache = [{ url: "/~offline", revision }];

await build({
  entryPoints: ["src/pwa/sw.ts"],
  outfile: "public/sw.js",
  bundle: true,
  format: "esm",
  target: "es2020",
  minify: true,
  define: { "self.__SW_MANIFEST": JSON.stringify(precache) },
  logLevel: "info",
});
