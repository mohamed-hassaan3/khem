"use server";

/**
 * How heavy is the film an editor just pasted?
 *
 * The dashboard warns — never blocks — when a hero or New Arrival film is
 * larger than the recommendation (prompts/mobile-video-hero-loading.md). The
 * resolution and length are read in the browser from the video's metadata;
 * the size cannot be, because the storefront's CSP does not let the admin page
 * `fetch()` Cloudinary, and a `<video>` element does not expose byte counts.
 * So this action sends one `HEAD` request and returns `Content-Length`.
 *
 * ## Why this is not an open proxy
 *
 * - `requireAdmin()` first, like every action in this directory.
 * - **Cloudinary only.** `https://res.cloudinary.com/…` and nothing else, so
 *   it cannot be pointed at the VPS's loopback, the metadata endpoint of a
 *   cloud, or anyone else's server.
 * - `HEAD`, no body read, no redirects followed (`redirect: "manual"`), 10 s
 *   timeout. Only the status and the length are returned or logged.
 */

import { z } from "zod";

import { requireAdmin } from "@/src/lib/admin/auth";

const inputSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
    } catch {
      return false;
    }
  });

export type VideoInspection =
  | { ok: true; bytes: number | null }
  | { ok: false; reason: "not-cloudinary" | "unreachable" };

export async function inspectVideoUrl(input: unknown): Promise<VideoInspection> {
  await requireAdmin();

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "not-cloudinary" };

  try {
    const response = await fetch(parsed.data, {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
      // What a browser playing it would ask for, so `f_auto` picks the same file.
      headers: { Accept: "video/mp4,video/*;q=0.9,*/*;q=0.5" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return { ok: false, reason: "unreachable" };

    const length = Number(response.headers.get("content-length"));
    return { ok: true, bytes: Number.isFinite(length) && length > 0 ? length : null };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}
