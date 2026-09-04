"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Whether the fixed header should be off screen.
 *
 * The rule the visitor experiences: reading down the page puts the chrome away,
 * reaching back up brings it out, and a mouse sent to the top edge brings it
 * out without any scrolling at all — a pointer travelling that way is on its
 * way to the menu, the bag, or the search.
 *
 * ## Why this is a hook and not a scroll-linked animation
 *
 * The header only ever holds one of two positions, so there is nothing to
 * interpolate per frame: the transform lives in CSS and this decides which of
 * the two states is in force. Scroll work is coalesced into a single
 * `requestAnimationFrame` — the listener itself does nothing but record a
 * pending frame, so a fast flick costs one measurement per painted frame
 * rather than one per scroll event.
 *
 * ## Nothing here moves layout
 *
 * The caller translates a `position: fixed` element. `--header-h` — which the
 * page's top padding, every sticky offset and the mega-menu's `top` read — is
 * untouched, so hiding the bar cannot shift a single pixel of the document.
 *
 * ## Why state is only ever set from a listener
 *
 * Setting it from an effect body would cascade a second render on every open
 * and close of a menu. `forceVisible` is therefore *derived* into the returned
 * value and carried into the scroll handler through a ref, rather than driving
 * a `setState` of its own. This is sound because every surface that forces the
 * header open — both mega-menus, the drawer, the search panel — is opened from
 * a control *inside* the header, which cannot be reached while it is away.
 */

/**
 * How far down the page the header may first hide.
 *
 * Two bar-heights: near the top the bar is part of the composition (it sits
 * over the hero's own scrim), and taking it away for a 40px scroll reads as a
 * flicker rather than as an intent to read.
 */
const REVEAL_FLOOR = 160;

/**
 * The movement a direction change has to survive to count.
 *
 * Below this, momentum scrolling on iOS and a trackpad's settling frames both
 * produce direction flips the visitor never made — and each one would toggle
 * an animated bar.
 */
const DELTA = 8;

/** How near the top edge a mouse has to come to call the header back. */
const POINTER_ZONE = 96;

export function useHeaderVisibility(forceVisible: boolean): boolean {
  const [isHidden, setIsHidden] = useState(false);

  /**
   * The position the current direction was last measured from — reset on every
   * direction change, so {@link DELTA} is a distance travelled *this way* and
   * not a distance from the top of the document.
   */
  const anchor = useRef(0);
  const lastY = useRef(0);
  const forced = useRef(forceVisible);

  useEffect(() => {
    forced.current = forceVisible;
  }, [forceVisible]);

  useEffect(() => {
    anchor.current = window.scrollY;
    lastY.current = window.scrollY;

    let frame = 0;

    const measure = () => {
      frame = 0;

      const y = Math.max(0, window.scrollY);
      const previous = lastY.current;
      lastY.current = y;

      /*
       * A surface anchored to the header is open. Hold the bar out and keep
       * re-anchoring, so the first scroll after that surface closes is measured
       * from where the page is now rather than from wherever it was when the
       * menu opened.
       */
      if (forced.current) {
        anchor.current = y;
        setIsHidden(false);
        return;
      }

      // Direction changed: start measuring the new one from here.
      if (
        (y > previous && anchor.current > previous) ||
        (y < previous && anchor.current < previous)
      ) {
        anchor.current = previous;
      }

      if (y <= REVEAL_FLOOR) {
        anchor.current = y;
        setIsHidden(false);
        return;
      }

      const travelled = y - anchor.current;

      if (travelled > DELTA) setIsHidden(true);
      else if (travelled < -DELTA) setIsHidden(false);
    };

    const onScroll = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(measure);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  /*
   * The pointer listener is attached only while the bar is away, so a visible
   * header — which is most of a session — costs no pointer work at all.
   *
   * `pointerType` is the whole guard: a touch produces one `pointermove` per
   * drag, and a thumb that happens to start its swipe near the top of the
   * screen must not summon the bar it is scrolling away from.
   */
  useEffect(() => {
    if (!isHidden) return;

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      if (event.clientY > POINTER_ZONE) return;

      anchor.current = window.scrollY;
      setIsHidden(false);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [isHidden]);

  return isHidden && !forceVisible;
}
