"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { formatCommentDate, formatCount } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useDictionary, useDir } from "@/src/providers/i18n-provider";
import type { ProductCommentImage } from "@/src/types/comments";

/**
 * A visitor's photographs, and the way into them.
 *
 * Owns **both** halves — the thumbnail strip under a comment and the modal it
 * opens — because `<CommentRow>` is hook-free by contract: it renders on the
 * server for a stored comment and on the client for a freshly posted one, and
 * pulling state into it would end that. Everything interactive about a comment
 * lives here instead.
 *
 * ## Mounted on first open, not before
 *
 * A thread of fifty comments is fifty of these. Rendering every dialog up front
 * — the way `<CartDrawer>` legitimately does, being one panel for the whole app
 * — would put a hundred and fifty hidden `next/image` elements on the page and
 * fetch every one of them. So the dialog mounts the first time it is asked for
 * and *stays* mounted afterwards, which is what keeps the exit transition and
 * every subsequent open animating properly.
 *
 * ## Mechanics borrowed, not reinvented
 *
 * The modal is `<CartDrawer>`'s: `role="dialog"`, `aria-modal`, `inert` when
 * closed, Escape to close, a real tab trap, focus returned to the thumbnail
 * that opened it, and the page behind it locked. The carousel is
 * `<ProductGallery>`'s: a scroll-snap track whose active slide is *derived*
 * from an IntersectionObserver, moved with `scrollIntoView` and never with
 * `scrollLeft` arithmetic, whose sign flips under RTL.
 */

/** Focusable descendants, for the tab trap — the `<CartDrawer>` selector. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

/** Enough of a slide must be on screen before it counts as "the" slide. */
const VISIBLE_THRESHOLD = 0.6;

const ARROW_CLASS =
  "absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center border border-border-gold bg-background/60 text-ivory backdrop-blur-md transition-all duration-500 ease-out hover:border-gold hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-40";

export interface CommentLightboxProps {
  images: ProductCommentImage[];
  /** Already resolved to the author's name or the translated "Guest". */
  authorLabel: string;
  /** The comment itself, printed under the photograph. `null` for a rating. */
  body: string | null;
  createdAt: string;
  locale: Locale;
}

export default function CommentLightbox({
  images,
  authorLabel,
  body,
  createdAt,
  locale,
}: CommentLightboxProps) {
  const dict = useDictionary();
  const copy = dict.product.comments;
  const dir = useDir();
  const headingId = useId();

  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const panelRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  /** The thumbnail that opened the dialog, so focus can go back to it. */
  const triggerRef = useRef<HTMLElement | null>(null);

  const hasMultiple = images.length > 1;

  const open = (index: number) => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setActiveIndex(index);
    setIsMounted(true);
    setIsOpen(true);
  };

  const close = useCallback(() => setIsOpen(false), []);

  /*
   * Jump the track to the thumbnail that was clicked, without animating across
   * the intervening photographs — the visitor asked for this one, not a tour.
   * Runs on every open, which is why it watches `isOpen` and not `isMounted`.
   */
  useEffect(() => {
    if (!isOpen) return;

    const slide = trackRef.current?.children.item(activeIndex);
    slide?.scrollIntoView({ behavior: "auto", inline: "start", block: "nearest" });
    // `activeIndex` is deliberately absent: this aligns the track to the slide
    // chosen at *open* time, and re-running it on every swipe would fight the
    // scroll the visitor is performing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /** Report whichever slide is actually on screen. */
  useEffect(() => {
    const track = trackRef.current;
    if (!isMounted || !track || !hasMultiple) return;

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
  }, [isMounted, hasMultiple, images.length]);

  /*
   * Hand focus to the close button, and give it back to the thumbnail on the
   * way out. On the next frame, for the reason `<CartDrawer>` gives: focusing
   * an element mid-transform makes iOS Safari scroll to chase it.
   */
  useEffect(() => {
    if (!isOpen) return;

    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      cancelAnimationFrame(frame);
      triggerRef.current?.focus();
      triggerRef.current = null;
    };
  }, [isOpen]);

  // Lock the page behind the dialog; release on close and on unmount.
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;

      const clamped = Math.min(Math.max(index, 0), images.length - 1);
      const slide = track.children.item(clamped);
      if (!slide) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      slide.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        inline: "start",
        block: "nearest",
      });
    },
    [images.length],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    // `←`/`→` are physical keys; "next" is whichever way the text runs.
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (!hasMultiple) return;
      const forward =
        dir === "rtl" ? event.key === "ArrowLeft" : event.key === "ArrowRight";
      event.preventDefault();
      goTo(activeIndex + (forward ? 1 : -1));
      return;
    }

    // A tab trap, not a suggestion: a modal dialog must not leak focus to the
    // page it is covering.
    if (event.key !== "Tab") return;

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const PreviousIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const NextIcon = dir === "rtl" ? ChevronLeft : ChevronRight;

  if (images.length === 0) return null;

  return (
    <>
      {/* ── THUMBNAILS ─────────────────────────────── */}
      <div className="mt-4 flex flex-wrap gap-2">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => open(index)}
            aria-label={interpolate(copy.viewPhoto, {
              index: formatCount(index + 1, locale),
              total: formatCount(images.length, locale),
            })}
            className="relative size-20 overflow-hidden border border-border transition-colors duration-300 ease-out hover:border-gold focus-visible:border-gold focus-visible:outline-none"
          >
            <Image
              src={image.url}
              alt=""
              fill
              sizes="80px"
              className="object-cover brightness-90"
            />
          </button>
        ))}
      </div>

      {/* ── DIALOG ─────────────────────────────────── */}
      {isMounted ? (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            inert={!isOpen}
            onClick={close}
            className={[
              "fixed inset-0 z-1060 cursor-default bg-background/85 backdrop-blur-md",
              "transition-opacity duration-400 ease-luxury-bezier",
              isOpen ? "opacity-100" : "pointer-events-none opacity-0",
            ].join(" ")}
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            aria-hidden={!isOpen}
            inert={!isOpen}
            onKeyDown={onKeyDown}
            className={[
              "fixed inset-0 z-1061 flex flex-col",
              "transition-opacity duration-400 ease-luxury-bezier",
              isOpen ? "opacity-100" : "pointer-events-none opacity-0",
            ].join(" ")}
          >
            <div className="flex shrink-0 items-start justify-between px-5 pt-5 sm:px-8 sm:pt-7">
              <h2
                id={headingId}
                className="font-heading text-[11px] uppercase tracking-[0.2em] text-gold"
              >
                {interpolate(copy.lightboxLabel, { name: authorLabel })}
              </h2>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                aria-label={copy.photoClose}
                className="-me-2.5 grid size-11 cursor-pointer place-items-center text-ivory/50 transition-colors duration-300 ease-out hover:text-gold focus-visible:text-gold focus-visible:outline-none"
              >
                <X size={18} strokeWidth={1.25} aria-hidden="true" />
              </button>
            </div>

            <div className="relative min-h-0 flex-1 px-5 py-4 sm:px-8">
              <ul
                ref={trackRef}
                tabIndex={hasMultiple ? 0 : undefined}
                aria-roledescription={hasMultiple ? "carousel" : undefined}
                className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none [scrollbar-width:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold motion-safe:scroll-smooth [&::-webkit-scrollbar]:hidden"
              >
                {images.map((image, index) => (
                  <li
                    key={image.id}
                    className="relative h-full w-full flex-none snap-start"
                  >
                    <Image
                      src={image.url}
                      alt={interpolate(copy.photoAlt, {
                        index: formatCount(index + 1, locale),
                        name: authorLabel,
                      })}
                      fill
                      sizes="100vw"
                      className="object-contain"
                    />
                  </li>
                ))}
              </ul>

              {hasMultiple ? (
                <>
                  <button
                    type="button"
                    onClick={() => goTo(activeIndex - 1)}
                    disabled={activeIndex === 0}
                    aria-label={copy.photoPrevious}
                    className={`${ARROW_CLASS} start-7`}
                  >
                    <PreviousIcon className="size-4" strokeWidth={1.25} />
                  </button>

                  <button
                    type="button"
                    onClick={() => goTo(activeIndex + 1)}
                    disabled={activeIndex === images.length - 1}
                    aria-label={copy.photoNext}
                    className={`${ARROW_CLASS} end-7`}
                  >
                    <NextIcon className="size-4" strokeWidth={1.25} />
                  </button>
                </>
              ) : null}
            </div>

            {/* ── THE COMMENT, UNDER ITS PHOTOGRAPH ──── */}
            <div className="shrink-0 px-5 pb-7 text-center sm:px-8">
              <p className="mb-2 font-heading text-[11px] uppercase tracking-[0.2em] text-gold">
                {authorLabel}
                <span className="mx-3 text-ivory/20">·</span>
                <time
                  dateTime={createdAt}
                  className="tracking-wide text-ivory/35"
                  {...ltrIsland(locale)}
                >
                  {formatCommentDate(createdAt, locale)}
                </time>
              </p>

              {body ? (
                <p className="mx-auto max-w-2xl whitespace-pre-line text-[13px] leading-relaxed text-ivory/70">
                  {body}
                </p>
              ) : null}

              {hasMultiple ? (
                <p
                  className="mt-4 text-[11px] tabular-nums tracking-[0.2em] text-ivory/30"
                  {...ltrIsland(locale)}
                >
                  {interpolate(copy.photoCounter, {
                    index: formatCount(activeIndex + 1, locale),
                    total: formatCount(images.length, locale),
                  })}
                </p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
