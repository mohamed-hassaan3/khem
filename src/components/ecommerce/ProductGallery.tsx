"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { interpolate } from "@/src/lib/i18n/interpolate";
import { useDictionary, useDir } from "@/src/providers/i18n-provider";
import type { ProductImage } from "@/src/types/catalog";

/**
 * Product gallery — the only state on this page's left column.
 *
 * A native scroll-snap track rather than a cross-fade or a carousel library:
 * the browser gives swipe, momentum, trackpad and shift+wheel for free, and the
 * strip stays usable before hydration.
 *
 * There are no arrow controls. They were removed deliberately: they owned no
 * state — each one only called `scrollIntoView` on a slide — so everything they
 * offered is still reachable by swipe, by trackpad, by the arrow keys once the
 * track has focus, and by the thumbnail strip below. Scroll position is the source of truth —
 * `activeIndex` is *derived* from an IntersectionObserver, so a manual swipe
 * and a thumbnail click both end in the same state and never fight each other.
 *
 * Nothing here does arithmetic on `scrollLeft`: its sign and origin flip under
 * RTL. Scrolling goes through `scrollIntoView` on the slide itself, which is
 * direction-agnostic.
 *
 * ## Captions
 *
 * An image may carry a line of its own (`ProductImage.caption`), and the strip
 * under the track prints whichever belongs to the slide on screen. Every
 * fragrance photograph has `caption: null`, so this is inert on
 * `/perfume/[slug]` and only appears for the body-care and home-fragrance
 * galleries that were written with one — see
 * `supabase/sql/0013_product_image_caption.sql`.
 */

export interface ProductGalleryProps {
  images: ProductImage[];
  /** Fallback alt text for a record that shipped without one. */
  productName: string;
}

const SIZES = "(min-width: 1024px) 50vw, 100vw";

/** Enough of a slide must be on screen before it counts as "the" slide. */
const VISIBLE_THRESHOLD = 0.6;

export default function ProductGallery({
  images,
  productName,
}: ProductGalleryProps) {
  const dict = useDictionary();
  const dir = useDir();
  const trackRef = useRef<HTMLUListElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const hasMultiple = images.length > 1;
  const hasCaptions = images.some((image) => image.caption !== null);

  /**
   * Report whichever slide is actually on screen. Registered once per gallery;
   * `images.length` is the only thing that can add or remove observed nodes.
   */
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !hasMultiple) return;

    const slides = Array.from(track.children);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = slides.indexOf(entry.target);
          if (index >= 0) setActiveIndex(index);
        }
      },
      { root: track, threshold: VISIBLE_THRESHOLD },
    );

    for (const slide of slides) observer.observe(slide);

    return () => observer.disconnect();
  }, [hasMultiple, images.length]);

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;

      const clamped = Math.min(Math.max(index, 0), images.length - 1);
      const slide = track.children.item(clamped);
      if (!slide) return;

      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      slide.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        inline: "start",
        block: "nearest",
      });
    },
    [images.length],
  );

  /** `←`/`→` are physical keys; "next" is whichever way the text runs. */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    const forward =
      dir === "rtl" ? event.key === "ArrowLeft" : event.key === "ArrowRight";

    event.preventDefault();
    goTo(activeIndex + (forward ? 1 : -1));
  };

  /*
   * Stage 2 (`prompts/storefront-redesign-stage-2.md` D7/D8).
   *
   * Phone: one full-bleed swipe track, 440px at most, with a "1 / 4" counter
   * and slide dashes instead of the thumbnail strip, which cost 80px and
   * repeated what a swipe already offers.
   *
   * Desktop: the track becomes the lead image (5:4) and every photograph sits
   * under it in a three-column grid; choosing one scrolls the track to it. The
   * column stays in view while the details scroll beside it.
   */
  return (
    <div className="ground-stone flex w-full flex-col gap-3 sm:pb-6 lg:pb-0 lg:sticky lg:top-[calc(var(--chrome-h)+1.5rem)] lg:self-start lg:bg-transparent lg:transition-[top] lg:duration-500 lg:ease-luxury-bezier motion-reduce:transition-none">
      {/*
        The frame. Product photographs are 4:5 portraits.
        - Phone: full bleed, 440px at most (the mock).
        - Tablet portrait (sm–lg): the photograph's own 4:5, centred and
          capped at 560px wide, so nothing is cropped off the top or bottom.
        - Tablet landscape / small laptop (lg–xl): 4:5 in the gallery column.
        - Desktop (xl+): the 5:4 lead image from the desktop artboard.
      */}
      <div className="relative h-[min(440px,56svh)] w-full overflow-hidden bg-ground-bg sm:mx-auto sm:mt-6 sm:aspect-4/5 sm:h-auto sm:w-[min(100%_-_3rem,560px)] sm:rounded-lg lg:mt-0 lg:w-full xl:aspect-5/4">
        <ul
          ref={trackRef}
          tabIndex={hasMultiple ? 0 : undefined}
          onKeyDown={hasMultiple ? handleKeyDown : undefined}
          aria-roledescription={hasMultiple ? "carousel" : undefined}
          aria-label={interpolate(dict.product.gallery.label, {
            name: productName,
          })}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain khem-scroll-track outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold motion-safe:scroll-smooth"
        >
          {images.map((image, index) => (
            <li
              key={image.url}
              className="relative h-full w-full flex-none snap-start"
            >
              <Image
                src={image.url}
                alt={image.alt || productName}
                fill
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : undefined}
                sizes={SIZES}
                className="object-cover"
              />
            </li>
          ))}
        </ul>

        {hasMultiple ? (
          <>
            <span
              dir="ltr"
              aria-hidden="true"
              className="absolute bottom-3 end-3 rounded-full bg-ivory/90 px-2.5 py-1 text-[11px] tabular-nums text-ink lg:hidden"
            >
              {activeIndex + 1} / {images.length}
            </span>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-1.5 lg:hidden"
            >
              {images.map((image, index) => (
                <span
                  key={image.url}
                  className={`h-0.5 transition-[width,background-color] duration-500 ease-luxury-bezier motion-reduce:transition-none ${
                    index === activeIndex ? "w-4.5 bg-gold" : "w-2 bg-ivory/45"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/*
        Captions: rendered whenever *any* image has one and kept mounted as the
        slide changes, so the strip does not jog as the visitor moves through
        uncaptioned photographs.
      */}
      {hasCaptions ? (
        <p
          dir="auto"
          className="min-h-12 px-4 pb-3 text-xs leading-relaxed text-ground-muted lg:px-0"
        >
          {images[activeIndex]?.caption ?? ""}
        </p>
      ) : null}

      {hasMultiple ? (
        <div
          className={`hidden gap-3 lg:grid ${
            images.length % 4 === 0 ? "grid-cols-4" : "grid-cols-3"
          }`}
        >
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              aria-current={index === activeIndex ? "true" : undefined}
              aria-label={interpolate(dict.product.gallery.thumbnail, {
                index: index + 1,
                total: images.length,
              })}
              onClick={() => goTo(index)}
              className={`relative aspect-square cursor-pointer overflow-hidden rounded-lg outline-2 -outline-offset-2 transition-[outline-color,opacity] duration-300 ease-out focus-visible:outline-gold ${
                index === activeIndex
                  ? "outline-gold"
                  : "outline-transparent opacity-85 hover:opacity-100"
              }`}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="(min-width: 1024px) 18vw, 1px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
