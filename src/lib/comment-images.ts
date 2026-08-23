/**
 * Photographs attached to a product comment.
 *
 * One module for the three things the client, the schema and the Server Action
 * must agree on: how many files and how large, what a real JPEG/PNG/WEBP looks
 * like in its first bytes, and where an object path becomes a URL.
 *
 * Deliberately **not** `server-only`: the uploader in `<CommentImageUploader>`
 * needs the same limits the action enforces, and a second copy of `3` and
 * `5 MB` in the browser is exactly how a client comes to promise something the
 * server refuses. Nothing here reads a secret — {@link commentImageUrl} uses
 * `NEXT_PUBLIC_SUPABASE_URL`, which is public by construction.
 */

/** Bucket created by `supabase/sql/0018_comment_rating_images.sql`. */
export const COMMENT_IMAGE_BUCKET = "comment-images";

/** Photographs per comment. Mirrored by the uploader and by the schema. */
export const COMMENT_MAX_IMAGES = 3;

/** Per file. Mirrored by the bucket's own `file_size_limit`. */
export const COMMENT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * The only formats accepted.
 *
 * No GIF (an animation in a comment thread is a different product decision),
 * no SVG — an SVG is a script container, and this is a file a stranger uploads
 * for other visitors to open.
 */
export const COMMENT_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type CommentImageType = (typeof COMMENT_IMAGE_TYPES)[number];

/** Value for the file input's `accept`. */
export const COMMENT_IMAGE_ACCEPT = COMMENT_IMAGE_TYPES.join(",");

export function isCommentImageType(value: string): value is CommentImageType {
  return (COMMENT_IMAGE_TYPES as readonly string[]).includes(value);
}

/** Extension for the stored object path, keyed by the *sniffed* type. */
export const COMMENT_IMAGE_EXTENSION: Record<CommentImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * What the bytes actually are, or `null`.
 *
 * The MIME a browser reports is derived from the file extension and is a hint,
 * not evidence: `payload.pdf` renamed to `photo.png` arrives as `image/png`.
 * This reads the magic bytes instead, and the action stores whatever *this*
 * says — so a mismatch is a rejection rather than a mislabelled object.
 */
export function sniffImageType(bytes: Uint8Array): CommentImageType | null {
  // JPEG — SOI marker.
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG — the 8-byte signature, of which the first four are enough here.
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // WEBP — a RIFF container whose form type is "WEBP" at offset 8.
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * Bytes out of a `data:` URL, or `null` when it is not one.
 *
 * `atob` rather than `Buffer`, so the module stays importable from a Client
 * Component without dragging a Node polyfill into the bundle. The declared
 * media type in the prefix is discarded on purpose — {@link sniffImageType} is
 * the only thing allowed to say what these bytes are.
 */
export function decodeDataUrl(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;

  const header = dataUrl.slice(0, comma);
  if (!header.startsWith("data:") || !header.includes(";base64")) return null;

  try {
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    // Malformed base64. A caller treats this exactly like a failed sniff.
    return null;
  }
}

/** The Supabase project origin, or `null` when the app is unconfigured. */
function storageOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return url.length > 0 ? url.replace(/\/+$/, "") : null;
}

/**
 * Public URL for a stored object path.
 *
 * The one place a path becomes a URL, so the components never concatenate one:
 * a bucket rename is this file and the migration, and nothing else. Returns
 * `null` when unconfigured, which a caller renders as "no photograph" rather
 * than as a broken image.
 */
export function commentImageUrl(storagePath: string): string | null {
  const origin = storageOrigin();
  if (!origin) return null;

  // Each segment separately: a path segment is server-generated, but encoding
  // it is what keeps that guarantee from resting on the generator alone.
  const path = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${origin}/storage/v1/object/public/${COMMENT_IMAGE_BUCKET}/${path}`;
}

/**
 * Hostname of the storage origin — for `images.remotePatterns` in
 * `next.config.ts`, which cannot import from `src/` at config time and reads
 * the environment variable itself. Exported here so the two derivations of
 * "where the photographs live" at least start from the same helper shape.
 */
export function storageHostname(): string | null {
  const origin = storageOrigin();
  if (!origin) return null;

  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

/** Intrinsic pixel size, when the header can be read. */
export interface ImageSize {
  width: number;
  height: number;
}

/** Big-endian 16-bit read, the byte order every format below uses in its header. */
function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

/**
 * Dimensions from the file's own header, or `null`.
 *
 * Read on the server from the uploaded bytes rather than reported by the
 * browser: the numbers only reserve a box in the thread, but a value the client
 * chose is a value the client can make absurd, and `next/image` would then lay
 * the page out around it. Reading them here costs a few dozen bytes of parsing
 * and removes the question.
 *
 * Returns `null` for anything it cannot read — a progressive JPEG with an
 * unusual marker order, say. The column is nullable for exactly that case and
 * the thumbnail falls back to a fixed frame.
 */
export function readImageSize(
  bytes: Uint8Array,
  type: CommentImageType,
): ImageSize | null {
  if (type === "image/png") {
    // IHDR is always the first chunk: width and height at bytes 16 and 20.
    if (bytes.length < 24) return null;
    return { width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) };
  }

  if (type === "image/jpeg") {
    // Walk the marker segments until a Start Of Frame, which carries the size.
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;

      const marker = bytes[offset + 1];
      const length = readUint16BE(bytes, offset + 2);

      // SOF0–SOF3 and SOF5–SOF15. C4/C8/CC are tables and codes, not frames.
      const isFrame =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;

      if (isFrame) {
        return {
          height: readUint16BE(bytes, offset + 5),
          width: readUint16BE(bytes, offset + 7),
        };
      }

      if (length < 2) return null;
      offset += 2 + length;
    }
    return null;
  }

  // WEBP — three container flavours, each storing the size differently.
  if (bytes.length < 30) return null;

  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

  if (chunk === "VP8X") {
    // 24-bit little-endian, stored as (size - 1).
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }

  if (chunk === "VP8 ") {
    // Lossy: 14-bit dimensions after the 3-byte start code in the frame header.
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
    return { width, height };
  }

  if (chunk === "VP8L") {
    // Lossless: 14 bits each, packed across four bytes after the signature.
    const bits =
      bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  return null;
}
