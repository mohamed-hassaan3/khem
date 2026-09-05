import type { Metadata } from "next";
import Image from "next/image";

import NavGround from "@/src/components/NavGround";
import Reveal from "@/src/components/animation/Reveal";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import IngredientExplorer from "@/src/components/ingredients/IngredientExplorer";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { getIngredientDetails } from "@/src/services/content";

/**
 * ISR, 24 hours — a backstop, not the freshness mechanism.
 *
 * `revalidateIngredients()` re-renders this page whenever a material changes,
 * so the window only has to catch what that misses.
 *
 * It was an hour, which at this site's traffic meant most requests landed past
 * the window and paid for a regeneration. See `prompts/vercel-usage-reduction.md`.
 */
export const revalidate = 86400;

const PATH = "/ingredients";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return localeMetadata({
    locale: isLocale(locale) ? locale : "en",
    path: PATH,
    title: dict.ingredients.meta.title,
    description: dict.ingredients.meta.description,
    ogTitle: dict.ingredients.meta.ogTitle,
    ogDescription: dict.ingredients.meta.ogDescription,
  });
}

export default async function Ingredients({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // The locale is resolved before the materials are fetched, because they are
  // now read in the visitor's language.
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [ingredients, dict] = await Promise.all([
    getIngredientDetails(activeLocale),
    getDictionary(activeLocale),
  ]);

  return (
    <div className="min-h-screen">
      <NavGround ground="sand" />
      {/* ── HERO ───────────────────────────────────── */}
      {/*
        The page banner, as photography rather than as a dark mode.

        Every editorial page opened on the same thing: a full-viewport image
        crushed to a fifth of its brightness under an obsidian ground. §14 is
        blunt about it — repeating that banner is what "forces every page into
        a dark visual mode", and it was doing so above the fold on six routes.

        Three changes, the same three everywhere this pattern appears.

        The height comes down from the whole viewport, so the banner introduces
        the page rather than being the page, and the first light section is
        visible without scrolling. The image runs at its own luminance with no
        filter at all. And the type is charcoal on an ivory gradient rather than
        ivory on a darkened photograph — which is what makes this one banner
        language with the collection and category banners instead of a third.

        No top padding: the banner begins at the very top of the viewport and
        its photograph continues *behind* the header, which floats over it.
        Padding here would reserve a strip of blank ground above the image — a
        header area by another name, and precisely what the floating bar exists
        to avoid.

        No top padding, and no clearance maths: the page wrapper in
        `layout.tsx` reserves `--header-h` for the whole document, so this
        banner already starts below the nav rather than behind it. The section
        is sized to its own composition and nothing else.

        This carried a `pt-20` and an inflated `min-h` while the header floated
        over the content — both existed only to keep the heading out from under
        the bar, and both are dead weight now that the bar occupies its own
        space.
      */}
      <section className="ground-ivory relative flex h-[60vh] min-h-140 items-center overflow-hidden bg-sand">
        <Image
          src="https://images.unsplash.com/photo-1615885108069-7d5bef9a7e22?w=1800&h=900&fit=crop&auto=format"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div aria-hidden="true" className="banner-scrim banner-scrim-column" />

        <div className="relative z-10 max-w-3xl px-4 md:px-20 lg:px-30">
          <p className="eyebrow mb-8 md:mb-12">{dict.ingredients.hero.eyebrow}</p>
          <h1 className="mb-8 font-heading text-5xl font-normal leading-none text-ground sm:text-7xl md:text-8xl lg:text-9xl">
            {dict.ingredients.hero.headingLine1}
            <br />
            <span className="text-ground-accent">
              {dict.ingredients.hero.headingLine2}
            </span>
          </h1>
          <div className="gold-line mb-8" />
          <p className="max-w-lg text-sm leading-loose text-ground-muted">
            {dict.ingredients.hero.lede}
          </p>
        </div>
      </section>

      {/* ── GRID + DETAIL ───────────────────────────── */}
      <IngredientExplorer ingredients={ingredients} />

      {/* ── CTA ─────────────────────────────────────── */}
      <section className="ground-sand border-t border-ground-border px-4 py-14 text-center sm:px-6 md:px-10 lg:px-12 xl:px-16 md:py-30">
        <Reveal className="mx-auto max-w-xl">
          <p className="eyebrow mb-5">{dict.ingredients.cta.eyebrow}</p>
          <h2 className="mb-5 font-heading text-2xl font-normal text-ground sm:text-3xl md:text-4xl">
            {dict.ingredients.cta.heading}
          </h2>
          <p className="mb-11 text-[13px] leading-loose text-ground-muted">
            {dict.ingredients.cta.lede}
          </p>
          <LocaleLink href="/collections" className="btn btn-primary">
            {dict.ingredients.cta.primary}
          </LocaleLink>
        </Reveal>
      </section>
    </div>
  );
}
