// The public data Worker (iron-paradise-data). It serves two small JSON files
// that every member's phone reads: bulletin.json (hours, closures,
// announcements, crowd settings) and crowd.json (recent check-in times).
//
// Why a separate Worker: the free plan gives the main app 10 ms of CPU per
// request, and these files are read on every app open. This Worker has
// Cloudflare's Workers Cache switched on (wrangler.jsonc → cache), so a
// cached answer is served by Cloudflare's edge without running this code
// or using any CPU. A cache hit still counts as one request toward the
// account's daily request allowance. The cache is kept off the main app
// because switching it on there would make its static files count too.
//
// Each data centre caches each file for 60 seconds, so this code runs at
// most about once a minute per file per data centre, to read KV.
//
// The files are written only by the main app's Worker, through its KV
// binding, right after a save (src/bulletin/publish.ts). Nothing here
// writes, and nothing in the browser can write.

/** The slice of the KV binding this Worker uses. */
export interface PublicDataStore {
  get(key: string, type: "text"): Promise<string | null>;
}

export interface Env {
  PUBLIC_DATA: PublicDataStore;
}

/** The only files served; also their KV keys. */
const FILES = new Set(["/bulletin.json", "/crowd.json"]);

const baseHeaders = {
  // Public data with no cookies or credentials involved, so any page may
  // read it. The app reads it cross-origin from its own domain.
  "Access-Control-Allow-Origin": "*",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
};

function reply(
  body: string | null,
  status: number,
  maxAgeSeconds: number,
  contentType = "text/plain; charset=utf-8",
): Response {
  return new Response(body, {
    status,
    headers: {
      ...baseHeaders,
      "Content-Type": contentType,
      // Read by both Workers Cache and the browser. 60 s matches how often
      // the files can usefully change for a reader.
      "Cache-Control": `public, max-age=${maxAgeSeconds}`,
    },
  });
}

export async function handle(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, {
      status: 405,
      headers: { ...baseHeaders, Allow: "GET, HEAD" },
    });
  }

  const url = new URL(request.url);
  // The cache is keyed on the full URL, so ?anything=random would skip it
  // and reach KV every time, eating the free plan's daily KV reads. The app
  // never adds a query string; refuse any that arrive without touching KV.
  if (url.search || !FILES.has(url.pathname)) {
    return reply("Not found", 404, 3600);
  }

  const body = await env.PUBLIC_DATA.get(url.pathname.slice(1), "text");
  if (body === null) return reply("Not published yet", 404, 60);
  return reply(
    request.method === "HEAD" ? null : body,
    200,
    60,
    "application/json; charset=utf-8",
  );
}

const worker = { fetch: handle };
export default worker;
