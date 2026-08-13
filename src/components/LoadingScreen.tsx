import Image from "next/image";

/**
 * The house loading state — Server Component.
 *
 * A flat obsidian field with the KHEM roundel centred and a gold arc orbiting
 * it. Deliberately `fixed inset-0`: `loading.tsx` renders as a sibling of
 * `{children}` inside the root layout, so it sits *between* `<Nav>` and
 * `<Footer>` in the flow. Only taking the viewport makes it read as a page
 * state rather than a stray block of content.
 *
 * The animation is CSS only (`.khem-orbit` in `globals.css`), so this stays on
 * the server — a loading screen that needs to ship and hydrate a client bundle
 * before it can move defeats its own purpose.
 *
 * Note this is the brand default, not the answer for every route. Where the
 * incoming page has a strong, predictable shape, a skeleton of that shape reads
 * better — see `<CollectionSkeleton>`.
 */
export default function LoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      /*
       * Above the mega-menu overlay (`z-998`) and the nav, so a transition
       * started from an open menu is not half-covered by it.
       */
      className="fixed inset-0 z-1000 flex items-center justify-center bg-background"
    >
      <div className="relative grid size-54 place-items-center md:size-70">
        {/*
         * SVG rather than a bordered box: a real partial arc with round caps,
         * crisp at any size, and the dash length stays proportional to the
         * circle instead of needing a second set of breakpoints.
         *
         * r=47 → circumference ≈ 295.3, so `70 225` draws a ~24% arc.
         */}
        <svg
          viewBox="0 0 100 100"
          aria-hidden="true"
          className="absolute inset-0 size-full"
        >
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke="var(--color-border-gold)"
            strokeWidth="0.6"
          />

          <circle
            className="khem-orbit"
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth="1"
            strokeLinecap="round"
            strokeDasharray="70 225"
          />
        </svg>

        {/*
         * The roundel carries the wordmark, so it is decorative here — the
         * status role above is what announces the state. `object-contain`
         * centres the circular artwork inside its landscape canvas.
         */}
        <div className="relative size-40 md:size-52">
          <Image
            src="/loading.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 208px, 160px"
            className="object-contain"
          />
        </div>
      </div>
    </div>
  );
}
