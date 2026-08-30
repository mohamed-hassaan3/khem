"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import { LOCALE_DIRECTION } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { productHref } from "@/src/lib/routes";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";
import type { Ingredient } from "@/src/types/content";

/**
 * Ingredient catalog — every catalogued material, as cards that expand in place.
 *
 * The client boundary stops here: the page stays a Server Component and passes
 * already-queried records in, so `src/services/content.ts` is never pulled into
 * the browser bundle.
 *
 * The olfactive-family filter bar that used to sit above the grid is gone: the
 * catalog is short enough to read whole, and a bar that mostly showed "All" was
 * a control asking to be operated rather than a way in. The families themselves
 * are untouched — they still badge every card, and they still gather the five
 * scent profile pages (`src/lib/scent-profiles.ts`).
 *
 * ## Why the detail lives inside the card
 *
 * The detail used to be one panel rendered after the grid, which meant clicking
 * a card sent the reader somewhere else on the page. Now the selected card
 * takes its whole grid row and the detail unfurls beside its image — the image
 * keeps the column it already occupied, so it reads as the copy having been
 * hidden underneath it. Below `lg` the same content opens under the image
 * instead, which is the only place a 4-column reveal can go on a phone.
 *
 * Motion config follows AGENTS.md §2.2 — tween only, on the
 * `--ease-luxury-bezier` curve. `layout` is what makes the cards after the open
 * one glide down instead of jumping.
 *
 * ## Why the parameter is read from `window`, not from `useSearchParams`
 *
 * `?ingredient=<slug>` has to be linkable — a perfume detail page points at
 * `/ingredients?ingredient=oud` — but `useSearchParams` forces the subtree under
 * it to bail out to client rendering, which would strip the whole catalog out of
 * the prerendered HTML this ISR route depends on for SEO. Reading the parameter
 * after mount keeps the grid in the static HTML and opens a card on hydration.
 * Writes go through `history.replaceState`: opening a card is a view change, not
 * a navigation. Same trade-off, and same shape, as `<CollectionGrid>`.
 */

/** The `--ease-luxury-bezier` token expressed as a cubic-bezier tuple. */
const EASE_LUXURY: [number, number, number, number] = [0.16, 1, 0.3, 1];

const DURATION_SECONDS = 0.6;
const TRAVEL_PX = 48;

/** The query parameter carrying the open ingredient's slug. */
export const INGREDIENT_PARAM = "ingredient";

/**
 * The grid's column count per breakpoint, widest first — the same `sm:`/`lg:`
 * stops the grid classes below use.
 *
 * The count is needed in JS, not just CSS, because an expanded card has to be
 * moved to the start of *its own row* (see `ordered`), and "its own row" is a
 * function of how many columns are showing.
 */
const COLUMN_BREAKPOINTS = [
  { query: "(min-width: 1024px)", columns: 4 },
  { query: "(min-width: 640px)", columns: 2 },
] as const;

/** Column count at and above which the detail opens beside the image, not below. */
const SIDE_BY_SIDE_COLUMNS = 4;

export interface IngredientExplorerProps {
  ingredients: Ingredient[];
}

export default function IngredientExplorer({
  ingredients,
}: IngredientExplorerProps) {
  const dict = useDictionary();
  const locale = useLocale();
  const island = ltrIsland(locale);
  const prefersReducedMotion = useReducedMotion();

  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  /** Resolved after mount; `1` server-side, which is the narrowest layout. */
  const [columns, setColumns] = useState(1);

  /** Cards by slug, so a deep link can scroll the one it opened into view. */
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  /**
   * Resolve `?ingredient=` against the records on hand.
   *
   * The value is untrusted, so it is matched against known slugs and otherwise
   * ignored — a mistyped URL renders the plain grid rather than an empty one.
   */
  useEffect(() => {
    const read = () => {
      const slug = new URLSearchParams(window.location.search).get(
        INGREDIENT_PARAM,
      );
      const target = ingredients.find((ingredient) => ingredient.slug === slug);

      if (!target) {
        setActiveSlug(null);
        return;
      }

      setActiveSlug(target.slug);

      // One frame, so the row has expanded before it is centred.
      requestAnimationFrame(() => {
        cardRefs.current.get(target.slug)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    };

    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [ingredients]);

  /**
   * How many columns the grid is currently showing.
   *
   * Read from `matchMedia` rather than measured, so it costs no layout work and
   * stays in step with the Tailwind breakpoints by construction. Resolved after
   * mount, so the server and the first client render agree.
   */
  useEffect(() => {
    const media = COLUMN_BREAKPOINTS.map((breakpoint) => ({
      list: window.matchMedia(breakpoint.query),
      columns: breakpoint.columns,
    }));

    const sync = () =>
      setColumns(media.find(({ list }) => list.matches)?.columns ?? 1);

    sync();
    for (const { list } of media) list.addEventListener("change", sync);
    return () => {
      for (const { list } of media) list.removeEventListener("change", sync);
    };
  }, []);

  /** Open or close a card, keeping the URL in step without a router round trip. */
  function selectSlug(slug: string | null) {
    setActiveSlug(slug);

    const url = new URL(window.location.href);
    if (slug === null) url.searchParams.delete(INGREDIENT_PARAM);
    else url.searchParams.set(INGREDIENT_PARAM, slug);
    window.history.replaceState(null, "", url);
  }

  /**
   * The grid order, with an expanded card lifted to the start of its own row.
   *
   * A full-width card cannot begin mid-row: CSS auto-placement would push it to
   * the *next* row and leave the cards beside it stranded above a hole. Moving
   * it to its row's first slot instead means it opens exactly where it sits —
   * the same way the first card of a row already does — and the cards that
   * shared that row slide down past it. `layout` on each cell animates the
   * reorder, so nothing jumps.
   */
  const activeIndex = ingredients.findIndex(
    (ingredient) => ingredient.slug === activeSlug,
  );
  const rowStart =
    activeIndex < 0 ? -1 : Math.floor(activeIndex / columns) * columns;

  let ordered: Ingredient[] = ingredients;
  if (activeIndex >= 0 && rowStart !== activeIndex) {
    ordered = [...ingredients];
    const [active] = ordered.splice(activeIndex, 1);
    if (active) ordered.splice(rowStart, 0, active);
  }

  const isDesktop = columns >= SIDE_BY_SIDE_COLUMNS;

  /**
   * The detail's closed state: an inline-axis slide out from under the image on
   * desktop, a vertical unfold below it on smaller screens, and a plain fade
   * when the reader has asked for less motion.
   */
  const startSign = LOCALE_DIRECTION[locale] === "rtl" ? 1 : -1;
  const closed = prefersReducedMotion
    ? { opacity: 0 }
    : isDesktop
      ? { opacity: 0, x: startSign * TRAVEL_PX }
      : { opacity: 0, height: 0 };
  const open = prefersReducedMotion
    ? { opacity: 1 }
    : isDesktop
      ? { opacity: 1, x: 0 }
      : { opacity: 1, height: "auto" as const };

  const transition = {
    duration: prefersReducedMotion ? 0 : DURATION_SECONDS,
    ease: EASE_LUXURY,
  };

  return (
    <section className="ground-ivory px-4 py-10 md:px-20 md:py-20">
      <div className="mx-auto grid max-w-350 grid-cols-1 gap-0.5 bg-border sm:grid-cols-2 lg:grid-cols-4">
        {ordered.map((ingredient) => {
          const isActive = ingredient.slug === activeSlug;
          const panelId = `ingredient-detail-${ingredient.slug}`;

          return (
            <motion.div
              key={ingredient.slug}
              layout={prefersReducedMotion ? false : true}
              transition={transition}
              ref={(node: HTMLDivElement | null) => {
                if (node) cardRefs.current.set(ingredient.slug, node);
                else cardRefs.current.delete(ingredient.slug);
              }}
              className={`overflow-hidden border transition-colors duration-500 ease-out ${
                isActive
                  ? "border-gold/35 bg-gold/5 sm:col-span-2 lg:col-span-4"
                  : "border-transparent bg-stone hover:border-ground-accent/20"
              }`}
            >
              <div
                className={
                  isActive ? "grid grid-cols-1 lg:grid-cols-[25%_1fr]" : ""
                }
              >
                {/* The image never re-mounts between states — same node, same
                    src — so expanding a card does not re-request or flash it. */}
                <button
                  type="button"
                  aria-expanded={isActive}
                  aria-controls={panelId}
                  onClick={() =>
                    selectSlug(isActive ? null : ingredient.slug)
                  }
                  className="img-zoom block w-full overflow-hidden text-start"
                >
                  <div
                    className={`relative overflow-hidden bg-stone ${
                      isActive ? "h-65 lg:h-full lg:min-h-120" : "h-65"
                    }`}
                  >
                    <Image
                      src={ingredient.image.url}
                      alt={ingredient.image.alt}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>

                  {isActive ? null : (
                    <div className="px-6 pb-7 pt-6" {...island}>
                      <h3 className="mb-2 font-heading text-base font-normal tracking-wide text-ground">
                        {ingredient.name}
                      </h3>
                      <p className="mb-2 text-[10px] italic tracking-[0.12em] text-ground-accent/50">
                        {ingredient.latinName}
                      </p>
                      <p className="mb-3 text-[11px] tracking-wide text-ground-muted">
                        {interpolate(dict.home.ingredients.from, {
                          origin: ingredient.origin,
                        })}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {ingredient.families.map((family) => (
                          <span
                            key={family}
                            className="border border-ground-accent/15 px-2 py-0.5 text-[9px] tracking-widest text-gold/45"
                          >
                            {family}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {isActive ? (
                    <motion.div
                      key="detail"
                      id={panelId}
                      role="region"
                      aria-label={ingredient.name}
                      initial={closed}
                      animate={open}
                      exit={closed}
                      transition={transition}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col justify-center p-8 md:p-14">
                        <div className="flex items-start justify-between gap-4 md:gap-6">
                          <div>
                            <p className="eyebrow mb-2.5">
                              {ingredient.rarity}
                            </p>
                            <h3 className="mb-1 font-heading text-2xl font-normal text-ground md:text-4xl">
                              {ingredient.name}
                            </h3>
                            <p
                              {...island}
                              className="mb-1 text-xs italic tracking-wider text-ground-accent/55"
                            >
                              {ingredient.latinName}
                            </p>
                            <p className="text-[11px] tracking-widest text-ground-muted">
                              {interpolate(dict.home.ingredients.from, {
                                origin: ingredient.origin,
                              })}
                            </p>
                          </div>

                          <button
                            type="button"
                            aria-label={interpolate(
                              dict.ingredientsExplorer.closeDetails,
                              { name: ingredient.name },
                            )}
                            onClick={() => selectSlug(null)}
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
                          {ingredient.description}
                        </p>

                        <div className="grid grid-cols-1 gap-5 md:gap-8 sm:grid-cols-2">
                          <div>
                            <p className="mb-3 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent/50">
                              {dict.ingredientsExplorer.foundIn}
                            </p>
                            <ul className="flex flex-col gap-2">
                              {ingredient.usedIn.map((product) => (
                                <li key={product.slug}>
                                  {/* `productHref()`, never a hardcoded
                                      `/perfume/…`: a material used in a
                                      candle or a body oil opens on
                                      `/ritual/…`, and a set on its category
                                      page. */}
                                  <LocaleLink
                                    href={productHref(product)}
                                    className="flex items-center gap-2 text-xs text-ground-muted no-underline transition-colors duration-300 hover:text-ground-accent"
                                  >
                                    <span
                                      className="h-px w-4 bg-current"
                                      aria-hidden="true"
                                    />
                                    {product.name}
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
                              {ingredient.facts.map((fact) => (
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
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
