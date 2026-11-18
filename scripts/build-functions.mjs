// Bundles the Supabase Edge Functions (supabase/functions-src) into
// supabase/functions/<name>/index.js, one self-contained file each, so they
// reuse the app's own reminder code (src/notifications) as it is. Deno runs
// Node's built-in modules under "node:" names, so those stay external.
//
//   npm run fn:build
//   npx supabase functions deploy reminders send-test-push year-close
import { builtinModules } from "node:module";
import { build } from "esbuild";

const builtins = new Set(builtinModules);

/** "net" → external "node:net", which Deno provides. */
const nodeBuiltins = {
  name: "node-builtins",
  setup(b) {
    b.onResolve({ filter: /^(node:)?[a-z_/]+$/ }, ({ path }) => {
      const name = path.replace(/^node:/, "");
      return builtins.has(name)
        ? { path: `node:${name}`, external: true }
        : null;
    });
  },
};

/**
 * Next.js-only modules: the `server-only` marker is empty here, and the app's
 * database client (which needs OpenNext) is never used: the functions pass
 * their own connection (supabase/functions-src/env.ts).
 */
const nextOnly = {
  name: "next-only",
  setup(b) {
    b.onResolve({ filter: /^(server-only|@\/db\/client)$/ }, ({ path }) => ({
      path,
      namespace: "stub",
    }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, ({ path }) => ({
      contents:
        path === "server-only"
          ? ""
          : "export function getDb() { throw new Error('No app database client in Edge Functions'); }",
    }));
  },
};

for (const name of ["reminders", "send-test-push", "year-close"]) {
  await build({
    entryPoints: [`supabase/functions-src/${name}.ts`],
    outfile: `supabase/functions/${name}/index.js`,
    bundle: true,
    format: "esm",
    platform: "neutral",
    mainFields: ["module", "main"],
    conditions: ["import", "default"],
    target: "es2022",
    alias: { "@": "./src" },
    plugins: [nextOnly, nodeBuiltins],
    banner: {
      // Supabase's runtime has no Node globals; the Postgres driver expects
      // Buffer, process and setImmediate to exist.
      js: [
        "// Built by scripts/build-functions.mjs from supabase/functions-src. Do not edit.",
        'import { Buffer as __Buffer } from "node:buffer";',
        'import __process from "node:process";',
        "globalThis.Buffer ??= __Buffer;",
        "globalThis.process ??= __process;",
        'import { setImmediate as __setImmediate, clearImmediate as __clearImmediate } from "node:timers";',
        "globalThis.setImmediate ??= __setImmediate;",
        "globalThis.clearImmediate ??= __clearImmediate;",
      ].join(String.fromCharCode(10)),
    },
    logLevel: "warning",
  });
  console.log(`Built supabase/functions/${name}/index.js`);
}
