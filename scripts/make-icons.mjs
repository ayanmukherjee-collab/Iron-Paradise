// Builds the PWA and home-screen icons from the white "iP" mark in
// public/brand/logo.svg. Run with `npm run icons` after changing the logo.
//
// Maskable icons get extra padding because Android crops them to a circle or
// squircle; the mark has to sit inside the central 80% safe zone.

import { mkdir } from "node:fs/promises";
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

await mkdir(OUTPUT_DIR, { recursive: true });

for (const { file, size, markShare } of ICONS) {
  const markHeight = Math.round(size * markShare);
  const mark = await sharp(LOGO, { density: 600 })
    .resize({ height: markHeight })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(`${OUTPUT_DIR}/${file}`);

  console.log(`${OUTPUT_DIR}/${file}  ${size}x${size}`);
}
