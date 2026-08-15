/**
 * Offline email-logo generator — `npm run email:logo`.
 *
 * Same contract as `embed-catalog.ts`: run occasionally by a human, output
 * committed to the repository, never executed at build or request time.
 *
 * It exists because the source mark cannot be used in an email as it stands.
 * `public/loading.webp` is a 1536×1024 **WebP on a white background**, and both
 * halves of that are disqualifying:
 *
 *  - **WebP** does not render in Outlook on Windows, which is a large share of
 *    any customer list. Email images are PNG or JPEG, still, in 2026.
 *  - **The white surround** would appear as a white rectangle floating in the
 *    obsidian signature block. The seal is circular, so the fix is a circular
 *    alpha mask rather than flooding the corners with a background colour —
 *    a flooded colour stops matching the instant a client inverts the theme
 *    for dark mode, and leaves a visible square halo.
 *
 * The output is 480px for a 240px display box, so it stays sharp on retina
 * screens, which is where most mail is read.
 *
 * `sharp` is not a direct dependency — it arrives with Next.js for image
 * optimisation. That is fine for a script run by hand a few times a year: if a
 * future Next drops it, this fails loudly and the committed PNG keeps working.
 */

import sharp from "sharp";

const SOURCE = "public/loading.webp";
const OUTPUT = "public/email/khem-seal.png";

/** 2× the 240px display width in the signature block. */
const SIZE = 480;

async function main(): Promise<void> {
  // Trim the uniform white border down to the seal's own bounding box. The
  // threshold is loose enough to catch JPEG-ish noise in the white, tight
  // enough to stop at the gold ring.
  const trimmed = await sharp(SOURCE).trim({ threshold: 10 }).toBuffer();
  const { width, height } = await sharp(trimmed).metadata();

  if (!width || !height) {
    throw new Error(`Could not read dimensions from ${SOURCE}`);
  }

  console.log(`trimmed: ${width}×${height}`);

  // Centre-crop to a square before scaling, so the circle is not distorted.
  const side = Math.min(width, height);

  const square = await sharp(trimmed)
    .extract({
      left: Math.round((width - side) / 2),
      top: Math.round((height - side) / 2),
      width: side,
      height: side,
    })
    .resize(SIZE, SIZE, { fit: "cover" })
    .toBuffer();

  // `dest-in` keeps the source only where the mask is opaque — an antialiased
  // circular cutout, so the corners carry real transparency rather than a
  // guessed background colour. The 1px inset avoids a clipped outer ring.
  const mask = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}"><circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2 - 1}" fill="#ffffff"/></svg>`,
  );

  await sharp(square)
    .composite([{ input: mask, blend: "dest-in" }])
    // Palette-quantised: 264K → 78K, and mail clients download this on a
    // phone connection. The mark is line art over flat black, so 256 colours
    // hold the gold gradient without visible banding.
    .png({ compressionLevel: 9, palette: true, quality: 100, effort: 10 })
    .toFile(OUTPUT);

  const result = await sharp(OUTPUT).metadata();
  console.log(
    `wrote ${OUTPUT} — ${result.width}×${result.height}, alpha: ${result.hasAlpha}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
