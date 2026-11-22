import type { Metadata } from "next";

import NavGround from "@/src/components/NavGround";
import EditorialHero from "@/src/components/editorial/EditorialHero";
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
      <EditorialHero
        image={{
          src: "https://res.cloudinary.com/co1xzkhf/image/upload/ingredients-banner.webp",
          alt: "",
        }}
        eyebrow={dict.ingredients.hero.eyebrow}
        lines={[
          dict.ingredients.hero.headingLine1,
          dict.ingredients.hero.headingLine2,
        ]}
        lede={dict.ingredients.hero.lede}
        size="short"
      />

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
