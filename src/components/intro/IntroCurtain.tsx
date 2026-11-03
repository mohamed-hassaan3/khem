"use client";

import { useEffect } from "react";

/**
 * What ends the intro. Renders nothing.
 *
 * The entrance is CSS and needs no JavaScript (see `<CinematicIntro>`). This
 * component exists only to decide *when* the curtain opens, and to record that
 * it has played.
 *
 * ## The readiness rule
 *
 *   open when  (hydrated AND the above-the-fold media has decoded)
 *              but not before `MIN_HOLD_MS`
 *              and never later than `MIN_HOLD_MS + MAX_HOLD_MS`
 *
 * "Above-the-fold media" is every non-lazy `<img>` outside the intro itself
 * (next/image `priority` ones, i.e. the hero's first slide) plus any video
 * poster. It deliberately is NOT `window.load`: that waits on every
 * subresource — Clerk, fonts, analytics, lazy-ish images — and on a slow
 * first visit it is what held the curtain for 5s+.
 *
 * The floor is what stops a warm cache from cutting the sequence off mid-reveal
 * — an intro that plays half of itself is worse than none. The ceiling is what
 * stops a slow hero image from holding the curtain shut.
 *
 * ## Why the state machine lives on `<html>`
 *
 * `data-intro` follows the `data-header-hidden` idiom already in `globals.css`:
 * a document-level state that CSS reads, rather than a React tree that has to
 * re-render to change what is painted. It also lets the pre-paint script in the
 * root layout suppress the whole overlay before React exists.
 */

/** Set by the pre-paint script in `[locale]/layout.tsx`, and written here. */
const SEEN_KEY = "khem:intro:seen";

/** The choreography's own length. Must match `globals.css`. */
const MIN_HOLD_MS = 2200;
const MIN_HOLD_REDUCED_MS = 600;

/** How long readiness may be waited for beyond the floor. */
const MAX_HOLD_MS = 1000;

/** The exit's length. Must match `globals.css`. */
const EXIT_MS = 1100;
const EXIT_REDUCED_MS = 450;

/**
 * A press this early is the one that opened the tab, not a request to skip.
 */
const SKIP_AFTER_MS = 600;

/**
 * Resolves once the media the visitor will see first under the curtain has
 * decoded. Never rejects: a failed image must not hold the curtain.
 */
function aboveTheFoldMediaReady(): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    if (img.closest("#khem-intro")) return; // the intro's own artwork
    if (img.loading === "lazy") return; // below the fold by construction
    if (img.complete && img.naturalWidth > 0) return;
    tasks.push(img.decode().catch(() => undefined));
  });

  document.querySelectorAll<HTMLVideoElement>("video[poster]").forEach((v) => {
    if (!v.poster) return;
    const poster = new Image();
    poster.src = v.poster;
    tasks.push(poster.decode().catch(() => undefined));
  });

  return Promise.all(tasks).then(() => undefined);
}

export default function IntroCurtain() {
  useEffect(() => {
    const root = document.documentElement;


    // Already seen this session — the pre-paint script has hidden the overlay
    // and there is nothing to end.
    if (root.dataset.intro === "off") return;

    // Safari's private mode throws on write rather than failing quietly. A
    // visitor who gets the intro twice is a far smaller problem than one who
    // gets a blank page.
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage unavailable — the intro simply plays again next load */
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const floorMs = reduced ? MIN_HOLD_REDUCED_MS : MIN_HOLD_MS;
    const exitMs = reduced ? EXIT_REDUCED_MS : EXIT_MS;

    let skippable = false;
    let finished = false;

    const onSkip = () => {
      if (skippable) exit();
    };

    function exit() {
      if (finished) return;
      finished = true;

      window.removeEventListener("pointerdown", onSkip);
      window.removeEventListener("keydown", onSkip);

      root.dataset.intro = "exit";
      window.setTimeout(() => {
        root.dataset.intro = "done";
      }, exitMs);
    }

    /** Resolves when the above-the-fold media is ready (not `window.load`). */
    const loaded = aboveTheFoldMediaReady();

    const floor = new Promise<void>((resolve) => {
      window.setTimeout(resolve, floorMs);
    });

    const ceiling = new Promise<void>((resolve) => {
      window.setTimeout(resolve, floorMs + MAX_HOLD_MS);
    });

    void Promise.race([Promise.all([loaded, floor]), ceiling]).then(exit);

    window.setTimeout(() => {
      skippable = true;
    }, SKIP_AFTER_MS);

    window.addEventListener("pointerdown", onSkip);
    window.addEventListener("keydown", onSkip);
  }, []);

  return null;
}
