"use client";

import { useEffect, useState } from "react";

import { inspectVideoUrl } from "@/src/actions/admin/video";
import {
  MAX_FILM_SECONDS,
  isCloudinaryVideo,
  originalOf,
  videoSources,
} from "@/src/lib/video-url";

/**
 * The hint under a film field, and warnings that never block a save
 * (prompts/single-video-auto-renditions.md).
 *
 * One link per section; the storefront builds the phone and desktop cuts from
 * it (`src/lib/video-url.ts`). So this reports what visitors will actually
 * download — the size of each cut — and checks the uploaded original:
 *
 * - Width and length of the original: a hidden `<video preload="metadata">`
 *   on the link with every transformation removed.
 * - Size of each cut: `inspectVideoUrl()` (a HEAD request, Cloudinary only).
 * - Sound cannot be detected from a link; `ac_none` strips it anyway.
 */

export const FILM_HINT = `Upload an MP4 of up to ${MAX_FILM_SECONDS} s, 1920×1080, no sound. Longer films are cut to ${MAX_FILM_SECONDS} s; phones get a lighter 720px copy automatically.`;

const PHONE_BUDGET = 500 * 1024;
const DESKTOP_BUDGET = 2.5 * 1024 * 1024;
const DESKTOP_WIDTH = 1920;

interface Measured {
  width: number | null;
  seconds: number | null;
  phoneBytes: number | null;
  desktopBytes: number | null;
  failed: boolean;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

async function sizeOf(url: string): Promise<number | null> {
  try {
    const result = await inspectVideoUrl(url);
    return result.ok ? result.bytes : null;
  } catch {
    return null;
  }
}

function readMetadata(url: string): Promise<{ width: number | null; seconds: number | null; failed: boolean }> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    let settled = false;
    const finish = (value: { width: number | null; seconds: number | null; failed: boolean }) => {
      if (settled) return;
      settled = true;
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };
    video.addEventListener(
      "loadedmetadata",
      () =>
        finish({
          width: video.videoWidth || null,
          seconds: Number.isFinite(video.duration) ? video.duration : null,
          failed: false,
        }),
      { once: true },
    );
    video.addEventListener("error", () => finish({ width: null, seconds: null, failed: true }), {
      once: true,
    });
    window.setTimeout(() => finish({ width: null, seconds: null, failed: true }), 12_000);
    video.src = url;
  });
}

export default function VideoUrlCheck({ url }: { url: string }) {
  const trimmed = url.trim();
  const target = /^https:\/\/\S+$/.test(trimmed) ? trimmed : null;
  const [measured, setMeasured] = useState<{ for: string; value: Measured } | null>(null);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;

    // Debounced: a URL is pasted or typed, not measured per keystroke.
    const timer = window.setTimeout(() => {
      const cloudinary = isCloudinaryVideo(target);
      const cuts = videoSources(target);

      void Promise.all([
        readMetadata(originalOf(target)),
        cloudinary ? sizeOf(cuts.mobile) : Promise.resolve(null),
        cloudinary ? sizeOf(cuts.desktop) : Promise.resolve(null),
      ]).then(([meta, phoneBytes, desktopBytes]) => {
        if (cancelled) return;
        setMeasured({
          for: target,
          value: { width: meta.width, seconds: meta.seconds, phoneBytes, desktopBytes, failed: meta.failed },
        });
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
    const { width, seconds, phoneBytes, desktopBytes } = current;
    if (seconds !== null && seconds > MAX_FILM_SECONDS + 0.5) {
      warnings.push(
        `${seconds.toFixed(1)} s — will be cut to ${MAX_FILM_SECONDS} s. Check that the loop doesn’t jump.`,
      );
    }
    if (width !== null && width < DESKTOP_WIDTH) {
      warnings.push(`${width}px wide — will look soft on large screens (1920px recommended).`);
    }
    if (desktopBytes !== null && desktopBytes > DESKTOP_BUDGET) {
      warnings.push(
        `Desktop copy is ${formatBytes(desktopBytes)} — over the ${formatBytes(DESKTOP_BUDGET)} recommendation. A shorter film brings it down.`,
      );
    }
    if (phoneBytes !== null && phoneBytes > PHONE_BUDGET) {
      warnings.push(
        `Phone copy is ${formatBytes(phoneBytes)} — over the ${formatBytes(PHONE_BUDGET)} recommendation. A shorter film brings it down.`,
      );
    }
  }

  const sizes =
    current && (current.phoneBytes !== null || current.desktopBytes !== null)
      ? [
          current.phoneBytes !== null ? `phone ${formatBytes(current.phoneBytes)}` : null,
          current.desktopBytes !== null ? `desktop ${formatBytes(current.desktopBytes)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <div className="mt-1.5 space-y-1">
      <p className="field-hint">{FILM_HINT}</p>
      {target && !current ? <p className="field-hint">Checking the film…</p> : null}
      {current?.failed && sizes === null ? (
        <p className="field-hint">Couldn’t check this film — it will still save.</p>
      ) : null}
      {sizes ? <p className="field-hint">Visitors download: {sizes}.</p> : null}
      {warnings.length > 0 ? (
        <ul role="status" className="space-y-0.5 text-[11px] leading-relaxed text-warning">
          {warnings.map((warning) => (
            <li key={warning}>⚠ {warning} You can still save.</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
