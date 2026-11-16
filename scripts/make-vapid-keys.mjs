// Prints a new VAPID key pair for push notifications (RFC 8292). Run once:
//   node scripts/make-vapid-keys.mjs
// Put VAPID_PUBLIC_KEY in .env.local and as a Worker variable, and
// VAPID_PRIVATE_KEY as a Worker secret. Changing the keys later turns off
// reminders on every phone until each member turns them on again.

const toBase64Url = (bytes) => Buffer.from(bytes).toString("base64url");

const pair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);
const publicKey = new Uint8Array(
  await crypto.subtle.exportKey("raw", pair.publicKey),
);
const { d } = await crypto.subtle.exportKey("jwk", pair.privateKey);

console.log(`VAPID_PUBLIC_KEY=${toBase64Url(publicKey)}`);
console.log(`VAPID_PRIVATE_KEY=${d}`);
