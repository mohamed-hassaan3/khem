"use client";

import { useEffect, useRef, useState } from "react";

import { MOBILE_MEDIA_QUERY, videoSources } from "@/src/lib/video-url";

/**
 * A muted, looping film that downloads only once it is about to be seen.
 *
 * `<video autoPlay>` ignores `preload` — the browser fetches the film the
 * moment the element is parsed. Below the fold that was the New Arrival film
 * downloading on every home-page load before anyone scrolled to it. Here the
 * film has no `src` until an `IntersectionObserver` sees it 200px from the
 * viewport; it then picks the phone or desktop cut (`videoSources()`, no audio)
 * and plays, and pauses again when it leaves.
 *
 * The poster is an `<img>` underneath and the film fades in over it (500 ms)
 * once it is actually `playing` (prompts/mobile-video-hero-loading.md §8).
 * Under `prefers-reduced-motion` or Data Saver it never plays: the poster
 * stays, the same rule as the hero.
 *
 * `className` positions and tints the whole stack (poster and film together).
 */
export default function InViewVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const sources = videoSources(src);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (connection?.saveData) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          if (!video.getAttribute("src")) {
            video.src = window.matchMedia(MOBILE_MEDIA_QUERY).matches
              ? sources.mobile
              : sources.desktop;
          }
          // A refused autoplay (data saver, low-power mode) leaves the poster.
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [sources.desktop, sources.mobile]);

  return (
    <div aria-hidden="true" className={className}>
      {poster ? (
        // Below the fold, lazy, and already an editor-sized Cloudinary image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        onPlaying={() => setPlaying(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-luxury-bezier ${
          playing ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
