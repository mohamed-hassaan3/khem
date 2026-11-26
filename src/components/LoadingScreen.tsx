/**
 * The house loading state — Server Component.
 *
 * The header stays where it is, a gold hairline sweeps beneath it, and the page
 * below is a calm ivory field. That is all.
 *
 * It replaces a full-screen overlay: the KHEM roundel with a gold arc spinning
 * around it, covering the header on every navigation to a route that waits on
 * data (prompts/motion-and-first-impression-stage-8.md). A spinner is the
 * language of an app waiting on a server; a house that is opening the next
 * room keeps the room you are standing in. The header already carries the
 * mark, so the field carries none.
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
 * ## The hairline
 *
 * `.khem-route-line` in `globals.css`: fixed under the header, below the
 * mega-menu, CSS only — a loading state that needs a client bundle before it
 * can move defeats its own purpose. It stays invisible for its first 150 ms, so
 * a navigation that resolves quickly never shows a line flashing for a frame.
 * Under reduced motion it does not sweep; a still, faint line appears instead.
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
      <div aria-hidden="true" className="khem-route-line" />
    </div>
  );
}
