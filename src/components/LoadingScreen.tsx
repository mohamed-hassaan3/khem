import Image from "next/image";

/**
 * The house loading state — Server Component.
 *
 * A flat ivory field with the KHEM roundel centred and a gold arc orbiting it.
 *
 * Ivory rather than the obsidian this was, and that is the whole point of §38:
 * a dark full-screen loader between two light pages is the most jarring
 * dark/light switch on the site, because it happens *during* navigation and
 * the visitor cannot look away from it. The loading state now belongs to the
 * same environment as the pages either side of it, so a route transition reads
 * as the page settling rather than as the lights going out and coming back.
 *
 * ## Why it reserves height instead of only covering the viewport
 *
 * This was `fixed inset-0` alone, which takes the viewport visually and
 * *zero* space in the flow. `loading.tsx` renders as a sibling of `{children}`
 * inside the locale layout, between `<Nav>` and `<Footer>` — so while the
 * boundary was showing, the document was a header, nothing, and a footer, and
 * the footer sat just under the nav. When the real page arrived the footer was
 * pushed down the entire height of it.
 *
 * That was the whole of this site's layout shift. One shift, on the `<footer>`,
 * scoring 0.757 identically on every route measured, because the cause was the
 * shared boundary rather than anything on the pages themselves. Reserving a
 * viewport's worth of height in the flow puts the footer below the fold from
 * the first paint, which is where it will still be when the content lands.
 *
 * The `fixed` overlay is kept on top of the reserved block: the spacer holds
 * the document's shape, the overlay is what the visitor actually sees, and it
 * still covers the mega-menu and the nav the way a page state should.
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
    /*
      The spacer, a full `100svh`.

      The header is `fixed`, so it takes no space in the flow — the incoming
      page's first screen really is a whole viewport tall, and subtracting the
      header's 5rem left the footer 80px high and still shifting by that much.
      It was the same shift as the original one, three orders of magnitude
      smaller; sizing the spacer to what it actually stands in for removes the
      remainder.
    */
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="ground-ivory min-h-svh"
    >
      <div
        aria-hidden="true"
        /*
         * Above the mega-menu overlay (`z-998`) and the nav, so a transition
         * started from an open menu is not half-covered by it.
         */
        className="ground-ivory fixed inset-0 z-1000 flex items-center justify-center"
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
            stroke="var(--color-border-light)"
            strokeWidth="0.6"
          />

          <circle
            className="khem-orbit"
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke="var(--color-gold-deep)"
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
    </div>
  );
}
