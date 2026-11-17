// Runs after `vite build`: renders the public pages to HTML (web/src/
// prerender.tsx, built for Node into web/dist-ssr) and writes them into the
// site. "/" goes into index.html itself; every other address also gets
// index.html (the single-page fallback), where a style rule hides the
// landing markup before the first paint and the app takes over.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dist = fileURLToPath(new URL("./dist", import.meta.url));
const ssr = fileURLToPath(new URL("./dist-ssr/prerender.mjs", import.meta.url));
const { render } = await import(pathToFileURL(ssr).href);

const shell = readFileSync(join(dist, "index.html"), "utf8");
const emptyRoot = '<div id="root"></div>';
if (!shell.includes(emptyRoot))
  throw new Error("index.html has no empty #root");

const titles = {
  "/": "Iron Paradise Gym | Paradise is earned",
  "/privacy": "Privacy policy | Iron Paradise",
  "/terms": "Terms of use | Iron Paradise",
};

function page(path) {
  return shell
    .replace(/<title>[^<]*<\/title>/, `<title>${titles[path]}</title>`)
    .replace(
      emptyRoot,
      `<div id="root" data-path="${path}">${render(path)}</div>`,
    );
}

writeFileSync(join(dist, "index.html"), page("/"));
writeFileSync(join(dist, "privacy.html"), page("/privacy"));
writeFileSync(join(dist, "terms.html"), page("/terms"));
rmSync(fileURLToPath(new URL("./dist-ssr", import.meta.url)), {
  recursive: true,
  force: true,
});
console.log("Prerendered /, /privacy and /terms.");
