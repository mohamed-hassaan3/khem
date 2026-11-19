/**
 * Cloudinary video delivery URLs, rewritten at render time.
 *
 * Editors paste a delivery URL into the dashboard and it is stored exactly as
 * pasted. Everything here derives *another* URL from it — without audio, a
 * phone-sized fallback, a first-frame poster — so the stored value never has
 * to change and a rule here can be revised without a data migration
 * (prompts/mobile-video-hero-loading.md).
 *
 * Only `https://res.cloudinary.com/<cloud>/video/upload/…` is understood.
 * Any other URL is returned unchanged by every function, so a film hosted
 * elsewhere still plays — it just doesn't get the savings.
 *
 * ## Anatomy
 *
 *     https://res.cloudinary.com/<cloud>/video/upload/<t>/<t>/v123/<public_id>.mp4
 *
 * Zero or more transformation segments (`f_auto,q_auto,w_828`), an optional
 * version (`v1792146108`), then the public id, which may contain folders. A
 * segment is a transformation when every comma-separated part looks like a
 * Cloudinary parameter (`w_828`, `q_auto:eco`, `ac_none`); that is how a folder
 * name is told apart from one.
 */

/** Phones get this when the editor gave no mobile film. */
export const MOBILE_FALLBACK_TRANSFORMATION = "f_auto,q_auto:eco,w_720,ac_none";

/** Where the phone/desktop split is made — Tailwind's `md`. */
export const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

const PARAM = /^[a-z]{1,3}_[^/,]+$/;
const VERSION = /^v\d+$/;

interface ParsedVideoUrl {
  /** `https://res.cloudinary.com/<cloud>/video/upload` */
  base: string;
  transformations: string[];
  version: string | null;
  /** Folders and file name, extension included. */
  publicId: string;
  /** Query string and fragment, kept verbatim. */
  suffix: string;
}

function parse(url: string): ParsedVideoUrl | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com") return null;

  const parts = parsed.pathname.split("/").filter(Boolean);
  // [cloud, "video", "upload", ...rest]
  if (parts.length < 4 || parts[1] !== "video" || parts[2] !== "upload") return null;

  const rest = parts.slice(3);
  const transformations: string[] = [];
  while (rest.length > 1 && rest[0].split(",").every((p) => PARAM.test(p))) {
    transformations.push(rest.shift() as string);
  }
  const version = rest.length > 1 && VERSION.test(rest[0]) ? (rest.shift() as string) : null;
  if (rest.length === 0) return null;

  return {
    base: `https://res.cloudinary.com/${parts[0]}/video/upload`,
    transformations,
    version,
    publicId: rest.join("/"),
    suffix: `${parsed.search}${parsed.hash}`,
  };
}

function build(p: ParsedVideoUrl): string {
  return [p.base, ...p.transformations, ...(p.version ? [p.version] : []), p.publicId]
    .join("/")
    .concat(p.suffix);
}

/** True for a URL these helpers can rewrite. */
export function isCloudinaryVideo(url: string): boolean {
  return parse(url) !== null;
}

/**
 * The same film with its audio track removed (`ac_none`).
 *
 * Every film on the site is muted; the audio was downloaded and never heard.
 * Added to the last transformation segment, or as a segment of its own when
 * there is none. Idempotent, and leaves an explicit `ac_…` alone.
 */
export function withoutAudio(url: string): string {
  const p = parse(url);
  if (!p) return url;
  if (p.transformations.some((t) => t.split(",").some((part) => part.startsWith("ac_")))) {
    return build(p);
  }
  if (p.transformations.length === 0) {
    p.transformations = ["ac_none"];
  } else {
    const last = p.transformations.length - 1;
    p.transformations[last] = `${p.transformations[last]},ac_none`;
  }
  return build(p);
}

/**
 * A phone-sized, audio-free rendition of a desktop film, for when the editor
 * gave no mobile film. Replaces every transformation with
 * {@link MOBILE_FALLBACK_TRANSFORMATION}.
 */
export function mobileFallback(url: string): string {
  const p = parse(url);
  if (!p) return url;
  p.transformations = [MOBILE_FALLBACK_TRANSFORMATION];
  return build(p);
}

/**
 * The film's first frame as a JPEG (`so_0`), `width` pixels wide.
 * `null` for a URL that isn't a Cloudinary film — the caller then uses the
 * editor's poster field.
 */
export function firstFramePoster(url: string, width: number): string | null {
  const p = parse(url);
  if (!p) return null;
  p.transformations = [`so_0,w_${Math.round(width)},q_auto`];
  p.publicId = p.publicId.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
  p.suffix = "";
  return build(p);
}

/**
 * The two films a page needs: what a phone plays and what a desktop plays,
 * both without audio. A phone gets the editor's mobile film when there is
 * one, otherwise {@link mobileFallback} of the desktop film.
 */
export function videoSources(
  desktopUrl: string,
  mobileUrl: string | null | undefined,
): { desktop: string; mobile: string } {
  const mobile = mobileUrl && mobileUrl.trim().length > 0 ? mobileUrl.trim() : null;
  return {
    desktop: withoutAudio(desktopUrl),
    mobile: mobile ? withoutAudio(mobile) : mobileFallback(desktopUrl),
  };
}
