// Fails when the compressed Worker would exceed Cloudflare's free-plan limit
// of 3 MiB. Run after `npm run cf:build`. Wrangler's dry run reports the
// exact gzip size it would upload, so we parse that rather than guess.

import { execFileSync } from "node:child_process";

const LIMIT_KIB = 3 * 1024;
const WARN_AT = 0.85;

const output = execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["wrangler", "deploy", "--dry-run", "--outdir", ".wrangler/dry-run"],
  {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  },
);

const match = output.match(
  /Total Upload:\s*([\d.]+)\s*KiB\s*\/\s*gzip:\s*([\d.]+)\s*KiB/,
);
if (!match) {
  console.error(output);
  throw new Error("Could not find the upload size in wrangler's output");
}

const gzipKiB = Number(match[2]);
const share = gzipKiB / LIMIT_KIB;
console.log(
  `Worker size: ${gzipKiB.toFixed(0)} KiB gzipped of ${LIMIT_KIB} KiB (${(share * 100).toFixed(0)}%)`,
);

if (share > 1) {
  console.error(
    "Over Cloudflare's free-plan Worker limit. Trim dependencies before merging.",
  );
  process.exit(1);
}
if (share > WARN_AT) {
  console.warn("Warning: within 15% of the limit.");
}
