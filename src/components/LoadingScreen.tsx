import Image from "next/image";

import falcon from "@/public/logo/logo-transparent.webp";

/**
 * The house loading state — Server Component.
 *
 * The header stays where it is. In the middle of the page area, on the ivory
 * ground, the small gold falcon sits inside a fine gold ring that turns slowly
 * around it.
 *
 * It replaces a full-screen overlay: a 200 px roundel with a heavy orbiting
 * arc, covering the header on every navigation to a route that waits on data.
 * The user kept the spinner and asked for it to stop looking dated
 * (prompts/motion-and-first-impression-stage-8.md, "Revision"): it is now the
 * size of a seal, not a poster, and the room you are standing in stays lit.
 *
 * The *first* visit's entrance is a different thing and is untouched: that is
 * `<CinematicIntro>`, which plays once per session on the home page.
 *
 * ## Why it still reserves a whole viewport of height
 *
 * `loading.tsx` renders as a sibling of `{children}` inside the locale layout,
 * between `<Nav>` and `<Footer>`. An element taking no space there leaves the
 * document as a header, nothing, and a footer — and when the page arrives the
 * footer is pushed down its entire height. That was once this site's whole
 * layout shift: 0.757 on every route, because the cause was this shared
 * boundary. A full `100svh` (the header is `fixed`, so it takes no flow space)
 * keeps the footer below the fold from the first paint, where it will still be
 * when the content lands.
 *
 * ## The spinner
 *
 * `.khem-spinner` in `globals.css`, CSS only — a loading state that needs a
 * client bundle before it can move defeats its own purpose. It stays invisible
 * for its first 150 ms, so a navigation that resolves quickly never flashes
 * it. Under reduced motion the ring stands still.
 *
 * Where the incoming page has a strong, predictable shape, a skeleton of that
 * shape reads better still — see `<CollectionSkeleton>` and `/search`.
 */
export default function LoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="ground-ivory min-h-svh"
    >
      {/* The visible page area under the header; the spinner sits at its centre. */}
      <div className="grid h-[calc(100svh-var(--header-h))] place-items-center">
        <div aria-hidden="true" className="khem-spinner relative grid size-14 place-items-center">
          <svg viewBox="0 0 56 56" className="absolute inset-0 size-full">
            {/* The track: a faint full circle, so the turning arc has a path. */}
            <circle
              cx="28"
              cy="28"
              r="27"
              fill="none"
              stroke="var(--color-border-light)"
              strokeWidth="1"
            />
            {/*
             * r=27 → circumference ≈ 169.6, so `42 128` draws a quarter arc.
             * `vector-effect` keeps the stroke at 1px whatever the scale.
             */}
            <circle
              className="khem-spinner-arc"
              cx="28"
              cy="28"
              r="27"
              fill="none"
              stroke="var(--color-gold-deep)"
              strokeWidth="1"
              strokeLinecap="round"
              strokeDasharray="42 128"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <Image
            src={falcon}
            alt=""
            width={34}
            height={40}
            loading="eager"
            fetchPriority="low"
            sizes="34px"
            className="relative h-10 w-auto"
          />
        </div>
      </div>
    </div>
  );
}
