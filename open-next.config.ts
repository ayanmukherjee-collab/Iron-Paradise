import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Every page renders per request (the CSP nonce needs it). The only
// prerendered files are the manifest and the service worker, which never
// revalidate, so a read-only cache served from static assets is enough and
// needs no paid storage binding.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
