// Builds the PWA and home-screen icons, and public/favicon.ico, from the
// white "iP" mark in public/brand/logo.svg. Run with `npm run icons` after
// changing the logo.
//
// Maskable icons get extra padding because Android crops them to a circle or
// squircle; the mark has to sit inside the central 80% safe zone.
//
// favicon.ico matters for cost, not looks: browsers ask for /favicon.ico on
// their own, and without the file each ask ran the whole Worker to render a
// 404 page. As a static file Cloudflare serves it without running the Worker.

import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const LOGO = "public/brand/logo.svg";
const OUTPUT_DIR = "public/icons";
const BACKGROUND = "#1c1b1d";

const ICONS = [
  { file: "icon-192.png", size: 192, markShare: 0.62 },
  { file: "icon-512.png", size: 512, markShare: 0.62 },
  { file: "maskable-512.png", size: 512, markShare: 0.46 },
  { file: "apple-touch-icon.png", size: 180, markShare: 0.58 },
];

// Tab icons are tiny, so the mark fills more of the square.
const FAVICON_SIZES = [16, 32, 48];
const FAVICON_MARK_SHARE = 0.78;

/** The mark centred on the dark square, as PNG bytes. */
async function iconPng(size, markShare) {
  const markHeight = Math.round(size * markShare);
  const mark = await sharp(LOGO, { density: 600 })
    .resize({ height: markHeight })
    .png()
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Packs PNG images into one .ico file (every current browser reads PNG icons). */
function toIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = header.length + images.length * 16;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // no palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

await mkdir(OUTPUT_DIR, { recursive: true });

for (const { file, size, markShare } of ICONS) {
  await writeFile(`${OUTPUT_DIR}/${file}`, await iconPng(size, markShare));
  console.log(`${OUTPUT_DIR}/${file}  ${size}x${size}`);
}

const favicons = await Promise.all(
  FAVICON_SIZES.map(async (size) => ({
    size,
    png: await iconPng(size, FAVICON_MARK_SHARE),
  })),
);
await writeFile("public/favicon.ico", toIco(favicons));
console.log(`public/favicon.ico  ${FAVICON_SIZES.join(", ")}px`);
