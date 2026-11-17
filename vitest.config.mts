import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Shared components import next/* names; the static app's shims back them.
      "next/link": fileURLToPath(
        new URL("./web/src/shims/next-link.tsx", import.meta.url),
      ),
      "next/navigation": fileURLToPath(
        new URL("./web/src/shims/next-navigation.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "web/src/**/*.test.ts"],
    // The exhaustive date and ledger checks take several seconds each when
    // every test file runs at once (they passed alone but timed out at 5 s).
    testTimeout: 20_000,
  },
});
