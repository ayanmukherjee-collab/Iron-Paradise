import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Plain next/link prefetches every visible link, and each prefetch is a
// server render on the Worker; bursts of them hit its CPU limit (503s).
const plainLink = {
  name: "next/link",
  message: "Import Link from @/components/ui/link, which doesn't prefetch.",
};

// revalidatePath, redirect and friends make Next.js render a whole page
// inside the save's own request. On the Worker's 10 ms CPU allowance that
// can cut a save off after it was written, and saves can't be retried.
const renderAfterSave =
  "Server Actions only write. Return the result (or { redirectTo }) and let the page refresh itself: see src/components/ui/after-save.ts.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/link.tsx", "web/src/shims/**"],
    rules: {
      "no-restricted-imports": ["error", { paths: [plainLink] }],
    },
  },
  {
    // Signing in and out, and claiming an account, are rare and must reset
    // the whole app, so they keep their server-side redirects.
    files: ["src/**/*actions.ts"],
    ignores: ["src/auth/sign-in-actions.ts", "src/members/claim-actions.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            plainLink,
            {
              name: "next/cache",
              importNames: [
                "revalidatePath",
                "revalidateTag",
                "updateTag",
                "refresh",
              ],
              message: renderAfterSave,
            },
            {
              name: "next/navigation",
              importNames: ["redirect", "permanentRedirect"],
              message: renderAfterSave,
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
    // The static app's build (npm run web:build).
    "web/dist/**",
  ]),
]);

export default eslintConfig;
