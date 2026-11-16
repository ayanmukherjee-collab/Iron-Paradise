// Web Push with the Web Crypto API only, so it runs on Cloudflare Workers
// without Node's crypto or the `web-push` package.
//
// - The payload is encrypted to the browser's key (RFC 8291, "aes128gcm"
//   content coding from RFC 8188), so the push service in the middle can't
//   read it.
// - The request is signed with the app's VAPID key (RFC 8292), so the push
//   service knows it comes from the server the browser subscribed to.

export interface PushTarget {
  endpoint: string;
  /** The browser's P-256 public key, base64url (65 bytes uncompressed). */
  p256dh: string;
  /** The browser's 16-byte auth secret, base64url. */
  auth: string;
}

export interface VapidKeys {
  /** base64url, 65-byte uncompressed P-256 point. Also given to browsers. */
  publicKey: string;
  /** base64url, the 32-byte private scalar. Server only. */
  privateKey: string;
  /** "mailto:" or "https:" contact for push services. */
  subject: string;
}

const recordSize = 4096;
const encoder = new TextEncoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function hkdf(
  salt: Uint8Array<ArrayBuffer>,
  ikm: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  length: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/** JWK form of a P-256 key from its raw public point (and private scalar). */
function p256Jwk(publicKey: Uint8Array, privateKey?: Uint8Array): JsonWebKey {
  if (publicKey.length !== 65 || publicKey[0] !== 4) {
    throw new Error("Expected an uncompressed P-256 public key");
  }
  return {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(publicKey.slice(1, 33)),
    y: base64UrlEncode(publicKey.slice(33, 65)),
    ...(privateKey ? { d: base64UrlEncode(privateKey) } : {}),
    ext: true,
  };
}

export interface EncryptOptions {
  /** Tests only: fixed values from RFC 8291's worked example. */
  salt?: Uint8Array<ArrayBuffer>;
  serverKeys?: { publicKey: Uint8Array; privateKey: Uint8Array };
}

/** The encrypted request body for one browser (RFC 8291 §3, RFC 8188 §2). */
export async function encryptPayload(
  target: PushTarget,
  payload: string,
  options: EncryptOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = base64UrlDecode(target.p256dh);
  const authSecret = base64UrlDecode(target.auth);
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));

  // A fresh key pair per message: the browser's key plus this one give a
  // secret only the two ends can work out.
  let serverPrivate: CryptoKey;
  let serverPublic: Uint8Array;
  if (options.serverKeys) {
    serverPrivate = await crypto.subtle.importKey(
      "jwk",
      p256Jwk(options.serverKeys.publicKey, options.serverKeys.privateKey),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );
    serverPublic = options.serverKeys.publicKey;
  } else {
    const pair = (await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    )) as CryptoKeyPair;
    serverPrivate = pair.privateKey;
    serverPublic = new Uint8Array(
      await crypto.subtle.exportKey("raw", pair.publicKey),
    );
  }

  const browserKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: browserKey },
      serverPrivate,
      256,
    ),
  );

  const keyInfo = concat(
    encoder.encode("WebPush: info\0"),
    uaPublic,
    serverPublic,
  );
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const cek = await hkdf(
    salt,
    ikm,
    encoder.encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdf(
    salt,
    ikm,
    encoder.encode("Content-Encoding: nonce\0"),
    12,
  );

  // One record, so the plaintext ends with the last-record delimiter (2).
  const plaintext = concat(encoder.encode(payload), new Uint8Array([2]));
  if (plaintext.length + 16 > recordSize) {
    throw new Error("Push payload is too long for one record");
  }
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, [
    "encrypt",
  ]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      plaintext,
    ),
  );

  const header = new Uint8Array(16 + 4 + 1 + serverPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize);
  header[20] = serverPublic.length;
  header.set(serverPublic, 21);
  return concat(header, ciphertext);
}

/** A signed VAPID token for one push service (RFC 8292 §2). */
export async function vapidToken(
  audience: string,
  keys: VapidKeys,
  now: Date = new Date(),
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  // Push services accept at most 24 hours; 12 leaves room for clock drift.
  const claims = {
    aud: audience,
    exp: Math.floor(now.getTime() / 1000) + 12 * 60 * 60,
    sub: keys.subject,
  };
  const unsigned = [header, claims]
    .map((part) => base64UrlEncode(encoder.encode(JSON.stringify(part))))
    .join(".");

  const signingKey = await crypto.subtle.importKey(
    "jwk",
    p256Jwk(base64UrlDecode(keys.publicKey), base64UrlDecode(keys.privateKey)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  // Web Crypto returns the raw r||s signature JWS expects.
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      signingKey,
      encoder.encode(unsigned),
    ),
  );
  return `${unsigned}.${base64UrlEncode(signature)}`;
}

/** Everything needed to `fetch` one push message. */
export async function buildPushRequest(
  target: PushTarget,
  payload: string,
  keys: VapidKeys,
  ttlSeconds: number,
): Promise<{ url: string; init: RequestInit }> {
  const audience = new URL(target.endpoint).origin;
  const [body, token] = await Promise.all([
    encryptPayload(target, payload),
    vapidToken(audience, keys),
  ]);
  return {
    url: target.endpoint,
    init: {
      method: "POST",
      headers: {
        Authorization: `vapid t=${token}, k=${keys.publicKey}`,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(ttlSeconds),
        Urgency: "normal",
      },
      body,
    },
  };
}

/**
 * Push services a browser may hand us. A subscription's endpoint is chosen by
 * the browser, but saved through our server, so only these hosts are
 * accepted: the server never posts to an address someone typed in.
 */
const pushServiceHosts = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

export function isPushServiceEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === "https:" &&
      url.port === "" &&
      pushServiceHosts.some((host) => host.test(url.hostname))
    );
  } catch {
    return false;
  }
}
