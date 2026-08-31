"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import { interpolate } from "@/src/lib/i18n/interpolate";
import type { Hero as HeroConfig } from "@/src/types/content";

/**
 * The campaign hero — the first screen of `/` once the house has configured one.
 *
 * ## What this is not
 *
 * It is not a carousel library, and it is not a replacement for the typographic
 * hero. `src/app/[locale]/page.tsx` renders this only when `getHero()` came back
 * with media; with none configured the page keeps the composition it has always
 * opened on. So the question this component answers is narrow: given one or more
 * campaign images, or one film, how does the first screen behave.
 *
 * ## Images
 *
 * Every slide is in the same box, stacked, and the active one is at opacity 1.
 * The transition is a 1200ms CSS dissolve (`.khem-hero-slide` in `globals.css`)
 * — no transform, no `will-change` on a full-bleed photograph, nothing measured
 * per frame. A dissolve rather than a slide because a campaign image sliding
 * sideways is a shop; a campaign image dissolving is a house.
 *
 * **One slide does not rotate.** No interval is armed, no progress indicator is
 * drawn, and the slide simply is the hero — there is nowhere to rotate to, and
 * machinery that runs for a list of one is machinery that eventually runs
 * wrong. Two or more rotate on `slideDurationMs`. Nothing caps the count: only
 * the first image is fetched eagerly, so the fifth costs a request that happens
 * four rotations later, if the visitor is still there.
 *
 * ## The timer
 *
 * Exactly one `setInterval`, in one effect. Manual selection bumps `epoch`,
 * which is in that effect's dependency list — so choosing a slide tears the
 * interval down and starts a fresh one, and the newly chosen image holds for its
 * full duration rather than being rotated away a moment later. There is no
 * second timer anywhere in this file, and no path that can leave one running:
 * the effect's cleanup is the only owner.
 *
 * The rotation pauses while the tab is hidden and while a pointer is over the
 * hero. A background tab that keeps cycling is a background tab that keeps
 * decoding images.
 *
 * ## Video
 *
 * One film, muted, looping, `playsInline`, with a poster. Muted and inline is
 * what makes autoplay permissible at all; the poster is what a visitor sees when
 * it is not — on a data saver, on a browser that refuses, or before the first
 * frame arrives. `preload="metadata"` keeps the hero from spending a phone's
 * data on a video that may scroll past unwatched.
 *
 * ## Where the words sit
 *
 * `contentPosition` is the desk's decision, not this component's: a bottle
 * centred on a plain ground wants type over the middle, and a wide frame with
 * its subject on one side wants the words in the opposite corner. It moves
 * **the headline, description and button together and nothing else**. Both
 * arrangements are laid out with logical properties, so `BOTTOM_LEFT` becomes
 * bottom-*right* under `dir="rtl"` — the corner an Arabic reader finishes on,
 * which is what the editor actually chose.
 *
 * The progress indicator is not part of that group. It stays at the foot of the
 * frame, centred, wherever the words are: it describes the *slideshow*, not the
 * composition, and an indicator that moved with the copy would read as part of
 * the sentence it sat under.
 *
 * ## Motion and the reduced-motion preference
 *
 * Every animation here is CSS, so `prefers-reduced-motion` is honoured in the
 * stylesheet and holds before hydration. Under it the dissolve becomes a swap
 * and the content appears in place — but the *rotation* continues, for the
 * reason the announcement bar gives: which image is shown is content, and
 * freezing it would leave a reduced-motion visitor able to see only the first
 * of a campaign.
 */

export interface HeroLabels {
  /** Names the hero region for assistive technology. */
  region: string;
  /** "Show slide {index} of {total}" — interpolated per control. */
  slide: string;
  /** Fallback description of the film, when the desk supplied none. */
  video: string;
}

export default function Hero({
  hero,
  labels,
}: {
  hero: HeroConfig;
  labels: HeroLabels;
}) {
  const slides = hero.slides;
  const rotates = hero.mediaType === "IMAGES" && slides.length > 1;

  const [index, setIndex] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  /*
   * Pause while the tab is in the background. Registered even when the hero
   * does not rotate — the listener costs nothing and the alternative is a
   * conditional hook.
   */
  useEffect(() => {
    function sync() {
      setIsPaused(document.visibilityState === "hidden");
    }

    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    if (!rotates || isPaused) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, hero.slideDurationMs);

    return () => window.clearInterval(timer);
    // `epoch` is the reset: a manual selection restarts this interval.
  }, [rotates, isPaused, epoch, hero.slideDurationMs, slides.length]);

  function show(next: number) {
    setIndex(next);
    setEpoch((current) => current + 1);
  }

  const hasContent =
    hero.headline !== null ||
    hero.description !== null ||
    (hero.buttonLabel !== null && hero.buttonHref !== null);

  const isCorner = hero.contentPosition === "BOTTOM_LEFT";

  return (
    <section
      aria-label={labels.region}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      /*
       * `ground-obsidian`, where the typographic hero is `ground-ivory`. The
       * ground is not a colour preference — it is what tells `.btn-primary`,
       * the text tokens and the hairlines which side of the contrast they are
       * on. A hero made of photography is a dark surface whatever the
       * photograph happens to be, and the page declares the same to `<Nav>`.
       *
       * The height is one viewport **minus the header stack**, not `100svh`.
       * The page wrapper is padded by `--header-h` (`layout.tsx`), so a plain
       * `h-svh` section inside it ends a header's worth below the fold — which
       * is where the progress controls were, and a manual control nobody can
       * see is not a manual control. The floor is 30rem rather than the 40rem
       * the typographic composition uses, because on a short phone that floor
       * would put the controls back under the fold it just rescued them from.
       *
       * The alignment is the only thing `contentPosition` changes about the
       * frame itself: `items-end justify-start` gathers the column into the
       * lower start corner, and the padding below is what keeps it off the
       * edge. Both branches are static class strings — nothing is measured, so
       * the choice costs no layout work and cannot shift anything.
       */
      className={`ground-obsidian relative flex h-[calc(100svh-var(--header-h))] min-h-120 overflow-hidden ${
        isCorner
          ? "items-end justify-start"
          : "items-center justify-center"
      }`}
    >
      {hero.mediaType === "VIDEO" && hero.videoUrl ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={hero.videoUrl}
          poster={hero.videoPosterUrl ?? undefined}
          aria-label={hero.videoAlt ?? labels.video}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        slides.map((slide, at) => (
          <Image
            key={slide.id}
            src={slide.imageUrl}
            alt={slide.alt}
            fill
            sizes="100vw"
            /*
             * The first slide is the LCP candidate and is fetched eagerly; the
             * rest wait. That is what keeps a five-image campaign costing the
             * same first paint as a one-image one.
             */
            priority={at === 0}
            loading={at === 0 ? undefined : "lazy"}
            data-active={at === index}
            className="khem-hero-slide object-cover"
          />
        ))
      )}

      {/*
        The scrim, only when there is something to read.

        A bare visual hero is left exactly as photographed — darkening a
        campaign image to protect text that is not there is vandalism. With
        content, the wash is bottom-weighted so the type has a ground and the
        top of the image keeps its light. The middle stop carries most of the
        weight because that is where the standfirst sits, and a campaign
        photograph is as likely to be pale there as dark.

        In the corner composition it is two washes rather than one, and neither
        is the centred version turned up. A vertical wash that stops at the
        halfway mark, because the words occupy the lower half and darkening the
        top would be covering photograph nothing is written on; and a second
        wash from the **start edge**, because that is the half the block
        actually sits in. The horizontal one mirrors under `dir="rtl"` along
        with the block itself, so the shadow is always behind the words and
        never opposite them.
      */}
      {hasContent ? (
        <>
          <div
            aria-hidden
            className={
              isCorner
                ? "absolute inset-0 bg-linear-to-t from-black/80 via-black/30 via-55% to-transparent"
                : "absolute inset-0 bg-linear-to-t from-black/70 via-black/40 to-black/10"
            }
          />
          {isCorner ? (
            <div
              aria-hidden
              className="absolute inset-0 bg-linear-to-r from-black/55 via-black/10 via-45% to-transparent rtl:bg-linear-to-l"
            />
          ) : null}
        </>
      ) : null}

      {hasContent ? (
        <div
          className={`relative z-10 w-full ${
            isCorner
              ? "max-w-2xl px-6 pb-10 text-start sm:px-10 sm:pb-12 md:px-16 md:pb-16"
              : "mx-auto max-w-3xl px-6 text-center"
          }`}
        >
          {hero.headline ? (
            <h1
              dir="auto"
              className="khem-hero-reveal font-heading text-4xl font-normal leading-tight text-ground sm:text-5xl md:text-6xl lg:text-7xl"
            >
              {hero.headline}
            </h1>
          ) : null}

          {hero.description ? (
            <p
              dir="auto"
              style={{ animationDelay: "140ms" }}
              className={`khem-hero-reveal max-w-xl text-sm leading-relaxed text-ground-muted sm:text-base ${
                isCorner ? "" : "mx-auto"
              } ${hero.headline ? "mt-5" : ""}`}
            >
              {hero.description}
            </p>
          ) : null}

          {hero.buttonLabel && hero.buttonHref ? (
            <div
              style={{ animationDelay: "280ms" }}
              className={`khem-hero-reveal ${
                hero.headline || hero.description ? "mt-8" : ""
              }`}
            >
              <LocaleLink href={hero.buttonHref} className="btn btn-primary">
                {hero.buttonLabel}
              </LocaleLink>
            </div>
          ) : null}
        </div>
      ) : null}

      {/*
        The progress indicator, which is also the manual control.

        One segment per slide, each a real button — so a visitor who wants the
        image they just missed can have it back, and a keyboard reaches every
        slide. The active segment's fill is a compositor animation keyed on the
        index, which is what restarts it on every step, manual or automatic.

        Centred at the foot of the frame in every configuration. It belongs to
        the slideshow rather than to the copy, so `contentPosition` does not
        move it: an indicator that travelled with the words would read as part
        of the sentence above it rather than as a description of the rotation.
      */}
      {rotates ? (
        <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center gap-2 px-6 sm:bottom-10">
          {slides.map((slide, at) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => show(at)}
              aria-label={interpolate(labels.slide, {
                index: at + 1,
                total: slides.length,
              })}
              aria-current={at === index || undefined}
              className="group h-8 w-10 shrink-0 focus:outline-none sm:w-14"
            >
              <span className="relative block h-px w-full bg-ivory/30 transition-colors duration-500 group-hover:bg-ivory/60 group-focus-visible:bg-gold">
                {at === index ? (
                  <span
                    key={`${epoch}-${at}`}
                    style={{ animationDuration: `${hero.slideDurationMs}ms` }}
                    className="khem-hero-progress absolute inset-0 block bg-gold-soft"
                  />
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
