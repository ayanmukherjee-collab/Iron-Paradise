import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Plain next/link prefetches every visible link, and each prefetch is a
    // server render on the Worker; bursts of them hit its CPU limit (503s).
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/link.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message:
                "Import Link from @/components/ui/link, which doesn't prefetch.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated output: Cloudflare build, Wrangler cache, service worker bundle.
    ".open-next/**",
    ".wrangler/**",
    "public/sw.js",
    "supabase/.temp/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
