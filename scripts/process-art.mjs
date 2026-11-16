// Turns the full-size source art in assets/art into small greyscale WebP files
// for the landing page. Run with `npm run art` after adding or replacing art.
//
// The site is strictly black and white, so colour accents are dropped here
// rather than with CSS filters on every page load.

import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const SOURCE_DIR = "assets/art";
const OUTPUT_DIR = "public/art";
const WIDTHS = [560, 960];

const ART = ["goku", "saitama"];

await mkdir(OUTPUT_DIR, { recursive: true });

for (const name of ART) {
  const trimmed = await sharp(`${SOURCE_DIR}/${name}.png`)
    .trim({ threshold: 1 })
    .toBuffer({ resolveWithObject: true });

  for (const width of WIDTHS) {
    const outputWidth = Math.min(width, trimmed.info.width);
    const file = `${OUTPUT_DIR}/${name}-${width}.webp`;
    const { height, size } = await sharp(trimmed.data)
      .resize({ width: outputWidth })
      .grayscale()
      .webp({ quality: 72, alphaQuality: 90, effort: 6 })
      .toFile(file);
    console.log(
      `${file}  ${outputWidth}x${height}  ${Math.round(size / 1024)} KB`,
    );
  }
}
