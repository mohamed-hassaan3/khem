"use client";

import { useEffect, useRef, useState } from "react";

import {
  MOBILE_MEDIA_QUERY,
  firstFramePoster,
  videoSources,
} from "@/src/lib/video-url";

/**
 * The hero film: a poster first, the film only after the page has loaded.
 *
 * (prompts/mobile-video-hero-loading.md §6–7.)
 *
 * **The poster** is the film's own first frame from Cloudinary (`so_0`, JPEG),
 * 720px for phones and 1920px for desktops, as a `<picture>` in the server
 * HTML — so the preload scanner finds it, it is the LCP element, and the
 * intro curtain's readiness check (`IntroCurtain.tsx`) waits for it to decode:
 * the curtain never lifts onto an empty hero. A film hosted outside Cloudinary
 * has no derivable frame and uses the editor's poster field instead.
 *
 * **The film** has no `src` in the HTML. On the window `load` event (or at
 * once if it already fired) the right one is chosen — the phone film, or a
 * phone cut (`w_720`, `q_auto:eco`) or the desktop cut (`w_1920`), both capped
 * at 20 s and without audio — and played muted. It sits over the poster at opacity 0 and fades in
 * over 500 ms once it is actually `playing`, so a stalled or refused autoplay
 * simply leaves the poster. Nothing changes size: no layout shift.
 *
 * Under reduced motion or Data Saver the film is never requested.
 */
export default function HeroFilm({
  url,
  fallbackPosterUrl,
  alt,
}: {
  url: string;
  fallbackPosterUrl: string | null;
  alt: string;
}) {
  const sources = videoSources(url);
  const desktopPoster = firstFramePoster(sources.desktop, 1920) ?? fallbackPosterUrl;
  const mobilePoster = firstFramePoster(sources.mobile, 720) ?? desktopPoster;

  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (connection?.saveData) return;

    const start = () => {
      video.src = window.matchMedia(MOBILE_MEDIA_QUERY).matches
        ? sources.mobile
        : sources.desktop;
      // A refused autoplay (low-power mode, a browser policy) keeps the poster.
      void video.play().catch(() => undefined);
    };

    if (document.readyState === "complete") {
      start();
      return;
    }
    window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, [sources.desktop, sources.mobile]);

  return (
    <>
      {desktopPoster ? (
        <picture>
          {mobilePoster && mobilePoster !== desktopPoster ? (
            <source media={MOBILE_MEDIA_QUERY} srcSet={mobilePoster} />
          ) : null}
          {/* A plain <img>: a Cloudinary derivative, already sized and
              compressed; the optimizer would only re-encode it and add a hop
              before the LCP paint. */}
          <img
            src={desktopPoster}
            alt={alt}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </picture>
      ) : null}
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        onPlaying={() => setPlaying(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-luxury-bezier ${
          playing ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  );
}
