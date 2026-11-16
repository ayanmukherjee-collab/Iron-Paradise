import { describe, expect, it, vi } from "vitest";
import { base64UrlEncode } from "@/notifications/web-push";

vi.mock("server-only", () => ({}));

const { deliverPush } = await import("@/notifications/channels/push");

// The browser key from RFC 8291's example; any valid P-256 key works here.
const browser = {
  p256dh:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
};
const phone = {
  ...browser,
  endpoint: "https://fcm.googleapis.com/fcm/send/phone",
};
const laptop = {
  ...browser,
  endpoint: "https://updates.push.services.mozilla.com/wpush/v2/laptop",
};
const message = { title: "Test", body: "Hello", url: "/app", tag: "test" };

async function vapidKeys() {
  const pair = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const raw = new Uint8Array(
    await crypto.subtle.exportKey("raw", pair.publicKey),
  );
  const { d } = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return {
    publicKey: base64UrlEncode(raw),
    privateKey: d!,
    subject: "https://gym.example",
  };
}

function replies(statuses: Record<string, number>) {
  return vi.fn(async (url: string | URL | Request) => {
    const status = statuses[String(url)];
    return new Response(status === 201 ? null : "nope", { status });
  });
}

describe("deliverPush", () => {
  it("posts one encrypted request per browser and forgets the gone ones", async () => {
    const fetchFn = replies({ [phone.endpoint]: 201, [laptop.endpoint]: 410 });
    const result = await deliverPush(
      [phone, laptop],
      message,
      await vapidKeys(),
      fetchFn,
    );

    expect(fetchFn).toHaveBeenCalledTimes(2);
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect((init.body as Uint8Array).length).toBeGreaterThan(86);
    expect(result).toEqual({
      ok: true,
      delivered: 1,
      expiredEndpoints: [laptop.endpoint],
    });
  });

  it("fails with the push service's answer when no browser took it", async () => {
    const fetchFn = replies({ [phone.endpoint]: 403 });
    const result = await deliverPush(
      [phone],
      message,
      await vapidKeys(),
      fetchFn,
    );
    expect(result).toEqual({
      ok: false,
      delivered: 0,
      error: "403 nope",
      expiredEndpoints: [],
    });
  });
});
