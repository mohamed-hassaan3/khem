"use client";

import { useEffect, useState } from "react";

import { inspectVideoUrl } from "@/src/actions/admin/video";
import { withoutAudio } from "@/src/lib/video-url";

/**
 * The size recommendation under a film field, and a warning when the film is
 * over it. Never blocks a save (prompts/mobile-video-hero-loading.md).
 *
 * What is checked is the film visitors actually receive — the pasted URL with
 * `ac_none` added (`src/lib/video-url.ts`) — so the numbers match the
 * storefront rather than the original upload.
 *
 * - Resolution and length: a hidden `<video preload="metadata">`.
 * - Size: `inspectVideoUrl()` (a HEAD request, Cloudinary only).
 * - Sound cannot be detected from a link; `ac_none` strips it anyway.
 */

type Kind = "mobile" | "desktop";

const LIMITS: Record<
  Kind,
  { width: number; height: number; bytes: number; seconds: number; hint: string }
> = {
  mobile: {
    width: 720,
    height: 1280,
    bytes: 500 * 1024,
    seconds: 10,
    hint: "Recommended: 720×1280 (portrait), MP4, under 500 KB, 6–10 s, no sound.",
  },
  desktop: {
    width: 1920,
    height: 1080,
    bytes: 2.5 * 1024 * 1024,
    seconds: 10,
    hint: "Recommended: 1920×1080, MP4, under 2.5 MB, 6–10 s, no sound.",
  },
};

interface Measured {
  width: number | null;
  height: number | null;
  seconds: number | null;
  bytes: number | null;
  failed: boolean;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

export default function VideoUrlCheck({
  url,
  kind,
  emptyNote,
}: {
  url: string;
  kind: Kind;
  /** Shown when the field is empty (e.g. what phones get instead). */
  emptyNote?: string;
}) {
  const limits = LIMITS[kind];
  const trimmed = url.trim();
  const target = /^https:\/\/\S+$/.test(trimmed) ? withoutAudio(trimmed) : null;
  const [measured, setMeasured] = useState<{ for: string; value: Measured } | null>(null);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;

    // Debounced: a URL is typed or pasted, not measured per keystroke.
    const timer = window.setTimeout(() => {
      const value: Measured = { width: null, height: null, seconds: null, bytes: null, failed: false };
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;

      const metadata = new Promise<void>((resolve) => {
        const done = () => resolve();
        video.addEventListener(
          "loadedmetadata",
          () => {
            value.width = video.videoWidth || null;
            value.height = video.videoHeight || null;
            value.seconds = Number.isFinite(video.duration) ? video.duration : null;
            done();
          },
          { once: true },
        );
        video.addEventListener("error", () => { value.failed = true; done(); }, { once: true });
        window.setTimeout(done, 12_000);
      });
      video.src = target;

      const size = inspectVideoUrl(target).then((result) => {
        if (result.ok) value.bytes = result.bytes;
      }).catch(() => undefined);

      void Promise.all([metadata, size]).then(() => {
        video.removeAttribute("src");
        video.load();
        if (!cancelled) setMeasured({ for: target, value });
      });
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [target]);

  const current = measured && measured.for === target ? measured.value : null;
  const warnings: string[] = [];

  if (current) {
    const { width, height, seconds, bytes } = current;
    if (bytes !== null && bytes > limits.bytes) {
      warnings.push(`${formatBytes(bytes)} — over the ${formatBytes(limits.bytes)} recommendation.`);
    }
    if (width !== null && height !== null) {
      if (kind === "mobile" && width > height) {
        warnings.push(`${width}×${height} is landscape — phones show a portrait film best.`);
      }
      if (width > limits.width || height > limits.height) {
        warnings.push(`${width}×${height} — larger than ${limits.width}×${limits.height}.`);
      }
    }
    if (seconds !== null && seconds > limits.seconds + 0.5) {
      warnings.push(`${seconds.toFixed(1)} s — longer than ${limits.seconds} s.`);
    }
  }

  const couldNotCheck =
    current !== null && (current.failed || (current.bytes === null && current.width === null));

  return (
    <div className="mt-1.5 space-y-1">
      <p className="field-hint">{limits.hint}</p>
      {!target && emptyNote ? <p className="field-hint">{emptyNote}</p> : null}
      {target && !current ? <p className="field-hint">Checking the film…</p> : null}
      {couldNotCheck ? (
        <p className="field-hint">Couldn’t check this film — it will still save.</p>
      ) : null}
      {warnings.length > 0 ? (
        <ul role="status" className="space-y-0.5 text-[11px] leading-relaxed text-warning">
          {warnings.map((warning) => (
            <li key={warning}>⚠ {warning} You can still save.</li>
          ))}
        </ul>
      ) : null}
      {current && !couldNotCheck && warnings.length === 0 ? (
        <p className="field-hint">
          Within the recommendation
          {current.bytes !== null ? ` · ${formatBytes(current.bytes)}` : ""}
          {current.width !== null ? ` · ${current.width}×${current.height}` : ""}
          {current.seconds !== null ? ` · ${current.seconds.toFixed(1)} s` : ""}.
        </p>
      ) : null}
    </div>
  );
}
