"use client";

import { useEffect, useRef } from "react";

/**
 * A muted, looping film that downloads only once it is about to be seen.
 *
 * `<video autoPlay>` ignores `preload` — the browser fetches the film the
 * moment the element is parsed. Below the fold that was the New Arrival film
 * (1.15 MB) downloading on every mobile home-page load before anyone scrolled
 * to it. Here the element carries no `autoPlay`, `preload="none"`, and its
 * poster, so the first paint is identical; an `IntersectionObserver` starts it
 * 200px before it enters the viewport and pauses it when it leaves.
 *
 * Under `prefers-reduced-motion` it never plays: the poster stays, which is
 * the same rule the hero follows.
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

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
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
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      className={className}
    />
  );
}
