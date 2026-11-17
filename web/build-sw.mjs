// Runs after `vite build`: compiles the service worker (web/src/sw.ts) into
// web/dist/sw.js with the list of files to keep on the phone for offline
// use, and writes the web app manifest. Part of `npm run web:build`.
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const dist = fileURLToPath(new URL("./dist", import.meta.url));

/** Files under dist, as site paths ("/assets/index-abc.js"). */
function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? files(path)
      : [`/${relative(dist, path).replaceAll("\\", "/")}`];
  });
}

// The app shell and its hashed files (a new name means new content, so no
// revision is needed), plus the icons. Not the character art: it's large
// and only the landing page uses it.
const shellRevision = process.env.GITHUB_SHA ?? String(Date.now());
const precache = [
  { url: "/index.html", revision: shellRevision },
  ...files(dist)
    .filter(
      (path) =>
        (path.startsWith("/assets/") &&
          /\.(js|css|woff2)$/.test(path) &&
          // Only the Latin fonts; other scripts load if ever needed.
          (!path.endsWith(".woff2") || /-latin-(?!ext)/.test(path))) ||
        path.startsWith("/icons/"),
    )
    .map((url) => ({
      url,
      revision: url.startsWith("/assets/") ? null : shellRevision,
    })),
];

await build({
  entryPoints: [fileURLToPath(new URL("./src/sw.ts", import.meta.url))],
  outfile: join(dist, "sw.js"),
  bundle: true,
  format: "esm",
  target: "es2020",
  minify: true,
  define: { "self.__SW_MANIFEST": JSON.stringify(precache) },
  logLevel: "warning",
});

// Same values as src/app/manifest.ts (gym in src/content/landing.ts).
const manifest = {
  name: "Iron Paradise Gym",
  short_name: "Iron Paradise",
  description:
    "A no-nonsense strength gym in Bundu, Ranchi. Free weights, racks, machines and trainers on the floor. Hours, plans and directions inside.",
  id: "/app",
  start_url: "/app",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#1c1b1d",
  theme_color: "#1c1b1d",
  icons: [
    {
      src: "/icons/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};
writeFileSync(
  join(dist, "manifest.webmanifest"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(`Service worker: ${precache.length} files kept for offline use.`);
