import { describe, expect, it } from "vitest";
import {
  base64UrlDecode,
  base64UrlEncode,
  buildPushRequest,
  encryptPayload,
  isPushServiceEndpoint,
  vapidToken,
} from "@/notifications/web-push";

// The worked example in RFC 8291, Appendix A. Matching it byte for byte
// means browsers will be able to decrypt what we send.
const rfc = {
  plaintext: "When I grow up, I want to be a watermelon",
  serverPublic:
    "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  serverPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  browserPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  header:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  ciphertext:
    "8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ",
};

async function newVapidKeys() {
  const pair = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const raw = new Uint8Array(
    await crypto.subtle.exportKey("raw", pair.publicKey),
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return {
    verifyKey: pair.publicKey,
    keys: {
      publicKey: base64UrlEncode(raw),
      privateKey: jwk.d!,
      subject: "https://gym.example",
    },
  };
}

describe("payload encryption", () => {
  it("matches the RFC 8291 worked example exactly", async () => {
    const body = await encryptPayload(
      {
        endpoint: "https://push.example/x",
        p256dh: rfc.browserPublic,
        auth: rfc.authSecret,
      },
      rfc.plaintext,
      {
        salt: base64UrlDecode(rfc.salt),
        serverKeys: {
          publicKey: base64UrlDecode(rfc.serverPublic),
          privateKey: base64UrlDecode(rfc.serverPrivate),
        },
      },
    );
    expect(body.slice(0, 86)).toEqual(base64UrlDecode(rfc.header));
    expect(body.slice(86)).toEqual(base64UrlDecode(rfc.ciphertext));
  });

  it("uses a fresh key and salt for every message", async () => {
    const target = {
      endpoint: "https://push.example/x",
      p256dh: rfc.browserPublic,
      auth: rfc.authSecret,
    };
    const [first, second] = await Promise.all([
      encryptPayload(target, "same"),
      encryptPayload(target, "same"),
    ]);
    expect(first.slice(0, 16)).not.toEqual(second.slice(0, 16));
    expect(first.slice(21, 86)).not.toEqual(second.slice(21, 86));
  });
});

describe("VAPID", () => {
  it("signs a token the public key verifies, for the push service's origin", async () => {
    const { keys, verifyKey } = await newVapidKeys();
    const now = new Date("2026-11-16T03:30:00Z");
    const token = await vapidToken("https://fcm.googleapis.com", keys, now);

    const [header, claims, signature] = token.split(".");
    const decode = (part: string) =>
      JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));
    expect(decode(header)).toEqual({ typ: "JWT", alg: "ES256" });
    expect(decode(claims)).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: now.getTime() / 1000 + 12 * 3600,
      sub: "https://gym.example",
    });
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      verifyKey,
      base64UrlDecode(signature),
      new TextEncoder().encode(`${header}.${claims}`),
    );
    expect(valid).toBe(true);
  });

  it("builds a request with the headers push services require", async () => {
    const { keys } = await newVapidKeys();
    const { url, init } = await buildPushRequest(
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        p256dh: rfc.browserPublic,
        auth: rfc.authSecret,
      },
      "{}",
      keys,
      3600,
    );
    expect(url).toBe("https://fcm.googleapis.com/fcm/send/abc");
    expect(init.headers).toMatchObject({
      "Content-Encoding": "aes128gcm",
      TTL: "3600",
    });
    expect((init.headers as Record<string, string>).Authorization).toMatch(
      new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${keys.publicKey}$`),
    );
  });
});

describe("push endpoints", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/QK2abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("accepts %s", (endpoint) => {
    expect(isPushServiceEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com:8443/x",
    "https://evil.example/fcm.googleapis.com",
    "https://fcm.googleapis.com.evil.example/x",
    "https://127.0.0.1/x",
    "not a url",
  ])("rejects %s", (endpoint) => {
    expect(isPushServiceEndpoint(endpoint)).toBe(false);
  });
});
