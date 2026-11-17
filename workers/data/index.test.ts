import { describe, expect, it } from "vitest";
import { handle, type Env } from "./index";

const BASE = "https://iron-paradise-data.example.workers.dev";

function storeWith(files: Record<string, string>) {
  const reads: string[] = [];
  const env: Env = {
    PUBLIC_DATA: {
      async get(key) {
        reads.push(key);
        return files[key] ?? null;
      },
    },
  };
  return { env, reads };
}

describe("the public data Worker", () => {
  it("serves a published file as cacheable JSON", async () => {
    const { env } = storeWith({ "bulletin.json": '{"version":3}' });
    const response = await handle(new Request(`${BASE}/bulletin.json`), env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"version":3}');
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("says not found, briefly cached, before the first publish", async () => {
    const { env } = storeWith({});
    const response = await handle(new Request(`${BASE}/crowd.json`), env);

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
  });

  it("never reads KV for other paths", async () => {
    const { env, reads } = storeWith({ "secret.json": "{}" });
    for (const path of ["/secret.json", "/", "/bulletin.json/x", "/../x"]) {
      const response = await handle(new Request(`${BASE}${path}`), env);
      expect(response.status).toBe(404);
    }
    expect(reads).toEqual([]);
  });

  it("refuses query strings, which would get past the cache", async () => {
    const { env, reads } = storeWith({ "bulletin.json": "{}" });
    const response = await handle(
      new Request(`${BASE}/bulletin.json?bust=123`),
      env,
    );

    expect(response.status).toBe(404);
    expect(reads).toEqual([]);
  });

  it("refuses writes", async () => {
    const { env, reads } = storeWith({});
    const response = await handle(
      new Request(`${BASE}/bulletin.json`, { method: "PUT", body: "{}" }),
      env,
    );

    expect(response.status).toBe(405);
    expect(reads).toEqual([]);
  });

  it("answers HEAD without a body", async () => {
    const { env } = storeWith({ "crowd.json": '{"checkins":[]}' });
    const response = await handle(
      new Request(`${BASE}/crowd.json`, { method: "HEAD" }),
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });
});
