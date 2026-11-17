// Where phones read bulletin.json and crowd.json: the iron-paradise-data
// Worker (workers/data), which serves them from Cloudflare's cache so the
// reads never run the app's Worker. Public, so it's fine in the browser
// bundle. NEXT_PUBLIC_DATA_URL overrides it (read at build time).
export const DATA_ORIGIN = new URL(
  process.env.NEXT_PUBLIC_DATA_URL ||
    "https://iron-paradise-data.ayanmukherjee-official01.workers.dev",
).origin;

export const BULLETIN_URL = `${DATA_ORIGIN}/bulletin.json`;
export const CROWD_URL = `${DATA_ORIGIN}/crowd.json`;
