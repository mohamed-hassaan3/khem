"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ⚠️ TEMPORARY — a configured film, over the light field.
 *
 * Mounted by `<PrelaunchFilm>` **only** when `KHEM_PRELAUNCH_VIDEO_URL` is set.
 * With no film configured — the shipped default — this component is not in the
 * route's module graph at all and the cover ships zero client JavaScript for its
 * background.
 *
 * ## Why it fades in
 *
 * `data-playing` is set once the first frame has decoded, and the stylesheet
 * takes the element from `opacity: 0` to `1` over 600ms. Until then the visitor
 * is looking at the light field underneath, which is why this feature needs no
 * poster image and can never show the black rectangle §17 rules out.
 *
 * ## Reduced motion
 *
 * `autoPlay` is on the element rather than withheld until this effect runs,
 * because attributes are what make a muted inline video start without
 * JavaScript. The cost is honest and worth naming: a visitor who has asked for
 * reduced motion may see a moment of playback before hydration pauses it. The
 * alternative — starting playback only from this effect — would mean the film
 * never plays at all for anybody whose JavaScript is slow or blocked, which
 * trades a rare, brief flaw for a common, permanent one.
 *
 * The first frame is still revealed in that case: `loadeddata` fires for a
 * paused video, so a reduced-motion visitor gets the film as a still photograph
 * rather than an empty box.
 */
export default function PrelaunchVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  /** True once a frame exists to show. Drives the crossfade, nothing else. */
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (video === null) return;

    // Already buffered before hydration — a cached film, or a fast connection.
    // Without this the fade would wait for an event that has already fired.
    if (video.readyState >= 2) setHasFrame(true);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    /*
     * An arrow expression, not a `function` declaration: declarations are
     * hoisted, so TypeScript widens `video` back to `HTMLVideoElement | null`
     * inside one and the narrowing above is lost.
     */
    const apply = () => {
      if (reduced.matches) {
        video.pause();
        return;
      }

      // Rejected autoplay is not an error worth reporting: the field is still
      // moving underneath and the cover is complete without this element.
      void video.play().catch(() => undefined);
    };

    apply();
    reduced.addEventListener("change", apply);

    return () => reduced.removeEventListener("change", apply);
  }, []);

  return (
    <video
      ref={ref}
      className="khem-cover-video"
      data-playing={hasFrame ? "true" : undefined}
      onLoadedData={() => setHasFrame(true)}
      src={src}
      autoPlay
      muted
      loop
      playsInline
      // The film is decoration over a background that already stands on its own.
      // Metadata is enough to begin; the rest arrives while the visitor reads.
      preload="metadata"
      // Decorative in full, and unreachable by keyboard: there are no controls
      // to operate, so a tab stop here would be a stop at nothing.
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
