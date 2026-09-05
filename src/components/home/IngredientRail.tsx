"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { usageTypeLabel } from "@/src/lib/product-types";
import { productHref } from "@/src/lib/routes";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";
import type { Ingredient } from "@/src/types/content";

/**
 * The home page's ingredient rail — a horizontally scrolling row of materials.
 *
 * The client boundary stops here, the way it does in `<IngredientExplorer>`:
 * the page stays a Server Component and hands already-queried rows down, so
 * `src/services/content.ts` never reaches the browser bundle.
 *
 * ## Why a phone opens the detail in place
 *
 * On a desktop a card is a link to `/ingredients?ingredient=<slug>`, where the
 * explorer opens that material with its copy sliding out beside the image. A
 * phone has no room for a four-column reveal, and sending a reader who tapped a
 * thumbnail to a different route — past a hero, to a grid — is a heavy answer
 * to a light question. So below `md` the tap unfolds the same detail *under the
 * rail* instead, vertically, and the rail itself keeps scrolling sideways
 * exactly as it did. The horizontal reveal on a wide screen and the vertical
 * one on a narrow screen are the same gesture in the axis each has to spare.
 *
 * ## Why the card is still an anchor
 *
 * The mobile behaviour is a `preventDefault()` on a real `<LocaleLink>`, not a
 * `<button>`. Rendering two card trees — a link for wide screens, a button for
 * narrow — would mount the photograph twice and pay for it twice at the image
 * CDN, which `prompts/vercel-usage-reduction.md` rules out. Keeping one anchor
 * also keeps the crawlable link into `/ingredients` and keeps
 * cmd-click / middle-click opening a tab on every screen, which is why the
 * modifier keys are checked before anything is intercepted.
 *
 * Nothing is written to the URL. `/` is not a deep-link surface for a single
 * material — that is what `/ingredients?ingredient=` is for — and a
 * `replaceState` here would strand `?ingredient=` on the home page.
 *
 * Motion follows AGENTS.md §2.2: tween only, on `--ease-luxury-bezier`.
 */

/** The `--ease-luxury-bezier` token expressed as a cubic-bezier tuple. */
const EASE_LUXURY: [number, number, number, number] = [0.16, 1, 0.3, 1];

const DURATION_SECONDS = 0.6;

/**
 * Below `md` — the same stop the panel's `md:hidden` uses.
 *
 * Read at click time rather than held in state: the answer is only ever needed
 * in a handler, so a subscription would keep a listener alive for a question
 * nobody is asking between taps.
 */
const MOBILE_QUERY = "(max-width: 767px)";

export interface IngredientRailProps {
  ingredients: Ingredient[];
}

export default function IngredientRail({ ingredients }: IngredientRailProps) {
  const dict = useDictionary();
  const locale = useLocale();
  const island = ltrIsland(locale);
  const prefersReducedMotion = useReducedMotion();

  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const active =
    ingredients.find((ingredient) => ingredient.slug === activeSlug) ?? null;

  /** Escape closes the panel, the way it closes every other overlay on the site. */
  useEffect(() => {
    if (active === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveSlug(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);

  function handleCardClick(
    event: React.MouseEvent<HTMLAnchorElement>,
    slug: string,
  ) {
    // A modified click is a request for a new tab. Never intercept it.
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    if (!window.matchMedia(MOBILE_QUERY).matches) return;

    event.preventDefault();

    const next = slug === activeSlug ? null : slug;
    setActiveSlug(next);

    if (next === null) return;

    // One frame, so the panel has been laid out before it is scrolled to.
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  const closed = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, height: 0 };
  const open = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, height: "auto" as const };
  const transition = {
    duration: prefersReducedMotion ? 0 : DURATION_SECONDS,
    ease: EASE_LUXURY,
  };

  const panelId = "home-ingredient-detail";

  return (
    <>
      {/* Horizontal scroll rail */}
      <div className="flex gap-0.5 overflow-x-auto pb-4 ps-4 md:ps-20">
        {ingredients.map((ingredient) => {
          const isActive = ingredient.slug === activeSlug;

          return (
            <LocaleLink
              key={ingredient.id}
              href={`/ingredients?ingredient=${ingredient.slug}`}
              onClick={(event) => handleCardClick(event, ingredient.slug)}
              aria-expanded={isActive}
              aria-controls={isActive ? panelId : undefined}
              className={`img-zoom group relative w-[260px] flex-none overflow-hidden border bg-[var(--card-bg)] no-underline transition-colors duration-500 ease-out sm:w-[300px] ${
                isActive ? "border-gold/35 bg-gold/5" : "border-transparent"
              }`}
            >
              <div className="relative h-[380px] overflow-hidden">
                <Image
                  src={ingredient.image.url}
                  alt={ingredient.image.alt}
                  fill
                  sizes="(min-width: 640px) 300px, 260px"
                  className="object-cover"
                />
              </div>
              <div className="border-t border-ground-border p-6">
                {/* Ingredient name and origin come from the database — English only. */}
                <div {...island}>
                  <h3 className="mb-1 font-heading text-base font-normal text-ground">
                    {ingredient.name}
                  </h3>
                </div>
                <p className="text-xs tracking-wider text-ground-accent/60">
                  {interpolate(dict.home.ingredients.from, {
                    origin: ingredient.origin,
                  })}
                </p>
              </div>
            </LocaleLink>
          );
        })}
      </div>

      {/*
        The detail, phones only. `md:hidden` rather than a JS branch: a wide
        screen never opens one, so the markup that would draw it should not
        exist there either.
      */}
      <div className="md:hidden">
        <AnimatePresence initial={false}>
          {active !== null ? (
            <motion.div
              ref={panelRef}
              key={active.slug}
              id={panelId}
              role="region"
              aria-label={active.name}
              initial={closed}
              animate={open}
              exit={closed}
              transition={transition}
              className="overflow-hidden"
            >
              <div className="mx-4 mt-2 border border-gold/35 bg-gold/5 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow mb-2.5">{active.rarity}</p>
                    <h3 className="mb-1 font-heading text-2xl font-normal text-ground">
                      {active.name}
                    </h3>
                    <p
                      {...island}
                      className="mb-1 text-xs italic tracking-wider text-ground-accent/55"
                    >
                      {active.latinName}
                    </p>
                    <p className="text-[11px] tracking-widest text-ground-muted">
                      {interpolate(dict.home.ingredients.from, {
                        origin: active.origin,
                      })}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label={interpolate(
                      dict.ingredientsExplorer.closeDetails,
                      { name: active.name },
                    )}
                    onClick={() => setActiveSlug(null)}
                    className="flex h-9 w-9 flex-none items-center justify-center border border-ivory/12 text-ground-muted transition-colors duration-300 hover:border-gold hover:text-ground-accent"
                  >
                    <X size={14} strokeWidth={1.25} aria-hidden="true" />
                  </button>
                </div>

                <div className="gold-line my-6" />

                <p
                  dir="auto"
                  className="mb-8 text-[13px] leading-loose text-ground-muted"
                >
                  {active.description}
                </p>

                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <p className="mb-3 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent/50">
                      {dict.ingredientsExplorer.foundIn}
                    </p>
                    <ul className="flex flex-col gap-2">
                      {active.usedIn.map((product) => (
                        <li key={product.slug}>
                          {/* `productHref()`, never a hardcoded `/perfume/…`:
                              a material used in a candle or a body oil opens
                              on `/ritual/…`, and a set on its category page. */}
                          <LocaleLink
                            href={productHref(product)}
                            className="flex items-start gap-2 text-xs text-ground-muted no-underline transition-colors duration-300 hover:text-ground-accent"
                          >
                            <span
                              className="mt-2 h-px w-4 flex-none bg-current"
                              aria-hidden="true"
                            />
                            {/* Name *and* type: a perfume, a body mist and a
                                room spray can share one name, and a bare list
                                of names made those three the same row. */}
                            <span>
                              <span className="block">{product.name}</span>
                              <span className="mt-0.5 block text-[9px] uppercase tracking-[0.18em] text-ground-accent/50">
                                {usageTypeLabel(product, dict.product)}
                              </span>
                            </span>
                          </LocaleLink>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="mb-3 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent/50">
                      {dict.ingredientsExplorer.rareFacts}
                    </p>
                    <ul className="flex flex-col gap-2">
                      {active.facts.map((fact) => (
                        <li
                          key={fact}
                          dir="auto"
                          className="flex items-start gap-2 text-[11px] leading-relaxed text-ground-muted"
                        >
                          <span
                            className="flex-none text-ground-accent"
                            aria-hidden="true"
                          >
                            —
                          </span>
                          {fact}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}
