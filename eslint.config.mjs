import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// Shared components keep importing Link from @/components/ui/link (the one
// place that maps onto the router), never the router's own link directly.
const plainLink = {
  name: "next/link",
  message: "Import Link from @/components/ui/link.",
};

export default defineConfig([
  ...tseslint.configs.recommended,
  // The React Compiler's rules too (the app builds with the compiler).
  reactHooks.configs.flat["recommended-latest"],
  {
    files: ["src/**/*.{ts,tsx}", "web/src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/link.tsx", "web/src/shims/**"],
    rules: {
      "no-restricted-imports": ["error", { paths: [plainLink] }],
    },
  },
  {
    // Node scripts (build steps, art and icon tools).
    files: ["**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", URL: "readonly" },
    },
  },
  globalIgnores([
    "node_modules/**",
    "web/dist/**",
    "web/dist-ssr/**",
    // Built by scripts/build-functions.mjs.
    "supabase/functions/**",
    "supabase/.temp/**",
    ".wrangler/**",
    ".claude/**",
    "test-results/**",
    "coverage/**",
  ]),
]);
