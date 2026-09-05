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

  return (
    <div /*
        `ground-stone`: the gallery is a stage the product stands on, one step
        up from the ivory page around it so the bottle has a surface rather
        than floating in the document.

        It was `ground-obsidian` over `bg-card` — a charcoal well, which is how
        you light a dark product page and exactly what §25 rules out: the
        product environment is ivory, and the photograph is given room by
        negative space rather than by dropping the lights around it. The caption
        below resolves to charcoal-on-stone, which is legible without needing
        the well.
      */
      className="ground-stone flex w-full flex-col overflow-hidden transition-[top,height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none lg:sticky lg:top-[var(--chrome-h)] lg:h-[calc(100svh-var(--chrome-h))]">
      <div className="relative aspect-4/5 w-full overflow-hidden lg:aspect-auto lg:flex-1">
        <ul
          ref={trackRef}
          // Focusable so the arrow keys have somewhere to land; a plain list
          // would leave keyboard users with the thumbnails only.
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
                priority={index === 0}
                sizes={SIZES}
                className="object-cover brightness-90"
              />
            </li>
          ))}
        </ul>

      </div>

      {/*
        Rendered whenever *any* image has a line, and kept mounted as the slide
        changes: sizing the strip per slide would jog the thumbnails up and down
        each time the visitor stepped onto an uncaptioned photograph. `min-h`
        holds two lines open; `aria-live` is deliberately absent, since the
        caption follows a navigation the visitor just made rather than
        announcing itself.
      */}
      {hasCaptions ? (
        <p
          dir="auto"
          className="min-h-16 border-t border-ground-border bg-ground-bg px-6 py-4 text-xs leading-loose text-ground-muted"
        >
          {images[activeIndex]?.caption ?? ""}
        </p>
      ) : null}

      {hasMultiple ? (
        <div className="flex gap-px bg-ground-border p-px">
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
              className={`relative h-20 flex-1 overflow-hidden outline-2 -outline-offset-2 transition-[outline-color] duration-300 ease-out focus-visible:outline-gold ${
                index === activeIndex ? "outline-gold" : "outline-transparent"
              }`}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="120px"
                className="object-cover brightness-75"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
