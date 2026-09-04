import Image from "next/image";

import fullLogo from "@/public/logo/full-logo-transparent.webp";

import IntroCurtain from "./IntroCurtain";

/**
 * The house entrance — Server Component.
 *
 * An ivory field, the gold KHEM lockup arriving in three staged beats, a held
 * frame, then the field parting to reveal the boutique already standing behind
 * it. This is the *document*'s opening, not a route transition: it plays on the
 * first document load of a session and never again in that tab.
 *
 * ## Why this ships in the server HTML
 *
 * A client-mounted overlay appears only once React has hydrated, which means a
 * visible frame of the real site *first* — the one thing a curtain must never
 * do. So the markup and the entire entrance are here, in the first byte, and
 * the animation is CSS (`globals.css`, "Cinematic intro"). JavaScript only
 * *ends* the sequence; it is not needed to run it.
 *
 * That is the same reasoning `<LoadingScreen>` follows, and the inverse of the
 * lesson in `<Reveal>`: rendering hidden state into server HTML is a bug
 * everywhere on this site except here, where hiding the page is the feature.
 *
 * ## Why one image and not three
 *
 * The brief asks for falcon, then wordmark, then tagline. That is already the
 * vertical order *inside* `full-logo-transparent.webp`, so all three beats come
 * from one pass of light travelling down one piece of artwork — a mask
 * travelling with it (see `.khem-intro-art`). Nothing has to be cropped, no
 * second asset is downloaded, and the three beats cannot drift out of sync with
 * each other because they are not three animations.
 *
 * The alternatives were considered and rejected. `name-logo-transparent.webp`
 * is falcon *plus* wordmark, not the wordmark alone, so it cannot stage
 * anything. The SVGs in `public/logo/` are vectorised photographs — 621-828
 * paths carrying per-path fills sampled off the raster, 435-557 KB, no
 * falcon/wordmark/tagline grouping and no strokes to draw — so there is no
 * stroke-draw animation available from this brand's assets at all.
 *
 * ## Why it takes no space
 *
 * `fixed`, and nothing else. This site's entire 0.757 CLS once came from a
 * loading boundary that covered the viewport while reserving no flow height
 * (see `<LoadingScreen>`); the mirror-image mistake would be a full-screen
 * intro that reserves flow height it does not need. It contributes zero layout
 * shift because it contributes zero layout.
 */
export default function CinematicIntro() {
  return (
    <div
      id="khem-intro"
      /*
       * Decorative in full. The site behind it stays in the accessibility
       * tree and is read normally, so there is deliberately no focus trap and
       * no `inert` on the document — a screen-reader visitor is never held
       * behind a curtain they cannot perceive.
       */
      aria-hidden="true"
    >
      {/*
       * The two halves *are* the ivory ground, and they are what parts at the
       * end. The root itself is transparent: anything it painted would still
       * be there after they have gone.
       */}
      <div className="khem-intro-half khem-intro-half-top" />
      <div className="khem-intro-half khem-intro-half-bottom" />

      <div className="khem-intro-stage">
        {/* Light coming up behind the object. Rises once and stays. */}
        <div className="khem-intro-bloom" />

        <div className="khem-intro-lockup">
          <Image
            src={fullLogo}
            alt=""
            priority
            /*
             * Matches the `--khem-intro-w` clamps in `globals.css`. The
             * intrinsic 2000x1089 comes from the static import, so the box
             * exists at its final size before a single byte of the artwork
             * has arrived.
             */
            sizes="(min-width: 768px) 520px, 62vw"
            className="khem-intro-art"
          />
        </div>

        {/* The gold horizon the field will later part along. */}
        <div className="khem-intro-rule" />
      </div>

      <IntroCurtain />
    </div>
  );
}
