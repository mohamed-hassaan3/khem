"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState } from "react";

/**
 * The collections carousel — §5.
 *
 * ## Native scroll, not a carousel library
 *
 * The track is a flex row with `overflow-x: auto` and CSS scroll snapping. That
 * decision does most of the work for free, and each piece of it is something a
 * JavaScript carousel has to reimplement badly:
 *
 * - **Touch** is the platform's own scroll — real momentum, real rubber-banding,
 *   real interruptibility. A `translateX` driven by pointer events never feels
 *   like this, and on iOS it fights the browser for the gesture.
 * - **Keyboard** works because the track is a focusable scroll container: arrow
 *   keys scroll it natively. The buttons are an addition for pointer users, not
 *   the only way through.
 * - **No layout thrash.** Nothing is measured on resize and nothing is
 *   transformed, so there is no reflow storm and no `will-change` on a large
 *   image.
 * - **It works before hydration.** The cards are server-rendered inside a
 *   scrollable box; a visitor can swipe the moment they see it. The only thing
 *   JavaScript adds is the arrows and their disabled state.
 *
 * ## Widths, and the sliver
 *
 * `basis-[85%]` on a phone is deliberate: at 85% the next card's edge is
 * visible, which is the only honest way to say "this scrolls" without a hint
 * that has to be dismissed. §5 asks for exactly this. From `sm` two cards show,
 * from `lg` three.
 *
 * ## Motion
 *
 * `scroll-behavior: smooth` on the track, honoured by the browser, and switched
 * off wholesale by the `prefers-reduced-motion` block in `globals.css`. There
 * is no easing curve here to get wrong.
 */

export interface CollectionSliderProps {
  /** One element per card. Server-rendered cards are passed straight through. */
  children: React.ReactNode;
  /** Names the scroll region for assistive technology. */
  label: string;
  previousLabel: string;
  nextLabel: string;
  /**
   * How many cards the widest step shows. Three by default — the collections
   * rail this was written for — and four for the product band, whose cards are
   * narrower and whose row would otherwise read as half empty.
   *
   * Still capped by the number of children, so a rail never opens more slots
   * than it can fill.
   */
  lgPerView?: 2 | 3 | 4;
}

export default function CollectionSlider({
  children,
  label,
  previousLabel,
  nextLabel,
  lgPerView = 3,
}: CollectionSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const items = Children.toArray(children);

  /*
   * Never open more slots than there are cards.
   *
   * With three collections the ladder is 1 / 2 / 3 across. With two, a fixed
   * `lg:basis-[33.333%]` leaves a third of the row empty on desktop, which
   * reads as a missing card rather than a deliberate composition — and the
   * house currently features two. Capping the widest step at the number of
   * items is deterministic and needs no measurement.
   */
  /*
   * The ladder, written out rather than computed: Tailwind scans source text
   * for class names, so an interpolated `lg:basis-[calc(${n}%...)]` would be
   * invisible to it and the style would simply not exist.
   *
   * Each value is `100%/n` less the share of the `lg:gap-6` (1.5rem) each card
   * gives up: two-thirds of it at three across, three-quarters at four.
   */
  const WIDE_BASIS = {
    1: "lg:basis-full",
    2: "lg:basis-[calc(50%-0.75rem)]",
    3: "lg:basis-[calc(33.333%-1rem)]",
    4: "lg:basis-[calc(25%-1.125rem)]",
  } as const;

  const across = Math.min(lgPerView, Math.max(items.length, 1)) as 1 | 2 | 3 | 4;
  const wideBasis = WIDE_BASIS[across];

  /*
   * `Math.abs` on both edges, and a 2px tolerance.
   *
   * Under `dir="rtl"` `scrollLeft` is negative in every engine this site
   * supports, and sub-pixel layout means the end is rarely reached exactly.
   * Comparing absolute values against a small epsilon is what makes one
   * implementation correct in both directions instead of two mirrored ones.
   */
  const syncEdges = useCallback(() => {
    const track = trackRef.current;
    if (track === null) return;

    const position = Math.abs(track.scrollLeft);
    const maxScroll = track.scrollWidth - track.clientWidth;

    setAtStart(position <= 2);
    setAtEnd(position >= maxScroll - 2);
  }, []);

  useEffect(() => {
    syncEdges();

    const track = trackRef.current;
    if (track === null) return;

    /*
     * `ResizeObserver` as well as `scroll`: a card row that fits entirely at
     * one width and overflows at another has to re-decide whether the arrows
     * are usable, and no scroll event fires when only the container changed.
     */
    const observer = new ResizeObserver(syncEdges);
    observer.observe(track);

    track.addEventListener("scroll", syncEdges, { passive: true });

    return () => {
      observer.disconnect();
      track.removeEventListener("scroll", syncEdges);
    };
  }, [syncEdges]);

  /** Scrolls by one card, in reading order. */
  const step = useCallback((direction: -1 | 1) => {
    const track = trackRef.current;
    if (track === null) return;

    const firstCard = track.firstElementChild;
    const distance =
      firstCard instanceof HTMLElement
        ? firstCard.offsetWidth + CARD_GAP_PX
        : track.clientWidth * 0.8;

    /*
     * `scrollBy` with a signed delta rather than setting `scrollLeft`: the
     * browser applies it in the container's own direction, so this moves
     * "forward" in Arabic without the component knowing which way that is.
     */
    track.scrollBy({ left: direction * distance, behavior: "smooth" });
  }, []);

  const hasOverflow = !(atStart && atEnd);

  return (
    <div className="relative">
      <div
        ref={trackRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="khem-scroll-track flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold lg:gap-6"
      >
        {items.map((item, index) => (
          <div
            key={index}
            className={`min-w-0 shrink-0 basis-[85%] snap-start sm:basis-[calc(50%-0.5rem)] ${wideBasis}`}
          >
            {item}
          </div>
        ))}
      </div>

      {/*
        The arrows are pointer affordances only, so they are hidden where there
        is nothing to scroll to and below `sm`, where the gesture is the
        interface and a 44px control over a photograph is just something in the
        way.
      */}
      {hasOverflow ? (
        <div className="mt-6 hidden items-center justify-end gap-3 sm:flex">
          <SliderButton
            label={previousLabel}
            onClick={() => step(-1)}
            disabled={atStart}
          >
            {/* Logical, not visual: the glyph follows the reading direction. */}
            <ChevronLeft
              size={18}
              strokeWidth={1.25}
              aria-hidden="true"
              className="rtl:rotate-180"
            />
          </SliderButton>
          <SliderButton
            label={nextLabel}
            onClick={() => step(1)}
            disabled={atEnd}
          >
            <ChevronRight
              size={18}
              strokeWidth={1.25}
              aria-hidden="true"
              className="rtl:rotate-180"
            />
          </SliderButton>
        </div>
      ) : null}
    </div>
  );
}

/** Matches the `gap-4` / `lg:gap-6` on the track, in pixels. */
const CARD_GAP_PX = 16;

function SliderButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-11 cursor-pointer place-items-center rounded-sm border border-ground-border text-ground-muted transition-colors duration-300 ease-out hover:border-ground-accent hover:text-ground-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
