import "server-only";

/**
 * The house mark, carried **inside** the message.
 *
 * ## Why an attachment and not a URL
 *
 * Every mail client blocks remote images by default until the reader allows
 * them, and a signature whose logo is a grey broken-image box on first open is
 * worse than no logo. An inline attachment — a real MIME part, referenced from
 * the HTML by `cid:` — is part of the message the reader already downloaded, so
 * Gmail, Outlook, and Apple Mail render it immediately with no permission
 * prompt and no request back to khemperfumes.com.
 *
 * It also survives the case a remote URL cannot: a message read offline, or
 * forwarded months later after the asset path has moved.
 *
 * The cost is ~104KB on every send. That is the right trade for a house whose
 * first email to somebody is a brand surface.
 *
 * ## Why it still falls back to a URL
 *
 * `public/` is not automatically readable from a serverless function — the file
 * has to be traced into the bundle, which `next.config.ts` does via
 * `outputFileTracingIncludes`. If that ever silently stops working, the read
 * here fails, {@link logoAttachment} returns `null`, and
 * {@link logoSrc} hands the template the remote URL instead. The signature
 * degrades to what it was before this file existed rather than to a broken tag.
 *
 * ## The asset
 *
 * `public/email/khem-logo.png` — 480×480, circular alpha mask, palette PNG.
 * Square, which matters: the source art in `khem-seal.png` is 1536×1024, and an
 * `<img width="104" height="104">` around a 3:2 image squashes the falcon.
 * Regenerate with `npm run email:logo`.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { SITE_URL } from "@/src/lib/i18n/metadata";

/** The `cid:` reference the signature's `<img>` points at. */
export const LOGO_CONTENT_ID = "khem-logo";

/** File name the recipient's client shows if it lists parts. */
export const LOGO_FILENAME = "khem-logo.png";

const LOGO_PATH = path.join(process.cwd(), "public", "email", LOGO_FILENAME);

/** What Resend's `attachments` array takes. Structural, so the SDK stays out of here. */
export interface InlineAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  contentId: string;
}

/**
 * Read once per process, then reuse.
 *
 * `null` means "not attempted yet"; a failed attempt caches `false` so a
 * missing file costs one syscall per lambda rather than one per email.
 */
let cached: Buffer | null = null;
let failed = false;

/**
 * The mark as an inline MIME part, or `null` if it cannot be read.
 *
 * Never throws. A logo is not worth failing a receipt over.
 */
export async function logoAttachment(): Promise<InlineAttachment | null> {
  if (failed) return null;

  if (cached === null) {
    try {
      cached = await readFile(LOGO_PATH);
    } catch (cause) {
      failed = true;
      console.error(
        "[email] Logo not attached:",
        cause instanceof Error ? cause.message : "unknown error",
      );
      return null;
    }
  }

  return {
    filename: LOGO_FILENAME,
    content: cached,
    contentType: "image/png",
    contentId: LOGO_CONTENT_ID,
  };
}

/**
 * What the signature's `<img src>` should be.
 *
 * Takes the attachment rather than fetching it, so the template stays
 * synchronous — the same reason `signatureBlock` takes its social profiles as
 * an argument instead of reading them.
 *
 * `EMAIL_ASSET_BASE_URL` overrides the fallback host, for rendering mail
 * against a preview deployment. Email cannot resolve a relative path and cannot
 * reach `localhost`, so in local development without the attachment the mark
 * simply does not appear — which is why the attachment path is the one that
 * matters.
 */
export function logoSrc(attachment: InlineAttachment | null): string {
  if (attachment) return `cid:${LOGO_CONTENT_ID}`;

  const base = process.env.EMAIL_ASSET_BASE_URL ?? SITE_URL;
  return `${base}/email/${LOGO_FILENAME}`;
}
