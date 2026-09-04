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
 *   open when  (hydrated AND the document has finished loading)
 *              but not before `MIN_HOLD_MS`
 *              and never later than `MIN_HOLD_MS + MAX_HOLD_MS`
 *
 * The floor is what stops a warm cache from cutting the sequence off mid-reveal
 * — an intro that plays half of itself is worse than none. The ceiling is what
 * stops the home page's hero video from holding the curtain shut: `window.load`
 * waits on every subresource, and on a slow connection that is a hostage
 * situation, not a loading state.
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
const MAX_HOLD_MS = 4500;

/** The exit's length. Must match `globals.css`. */
const EXIT_MS = 1100;
const EXIT_REDUCED_MS = 450;

/**
 * A press this early is the one that opened the tab, not a request to skip.
 */
const SKIP_AFTER_MS = 600;

/*
 * Module scope, not a ref.
 *
 * Under React 19 StrictMode the effect runs mount → unmount → mount in
 * development. A ref guard would survive that, but the *cleanup* would not: it
 * would clear the timers that open the curtain, and the overlay would stay up
 * for ever. So this sequence deliberately owns no cleanup — it is a one-shot
 * document-level event, it must finish once started, and this flag is what
 * makes starting it twice impossible.
 */
let launched = false;

export default function IntroCurtain() {
  useEffect(() => {
    if (launched) return;
    launched = true;

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

    /** Resolves when the document and its subresources have finished. */
    const loaded = new Promise<void>((resolve) => {
      if (document.readyState === "complete") {
        resolve();
        return;
      }
      window.addEventListener("load", () => resolve(), { once: true });
    });

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
