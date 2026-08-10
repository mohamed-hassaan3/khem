import type { Metadata } from "next";
import Image from "next/image";

import Reveal from "@/src/components/animation/Reveal";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import IngredientExplorer from "@/src/components/ingredients/IngredientExplorer";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import {
  getIngredientDetails,
  getIngredientFamilies,
} from "@/src/services/content";

/** ISR, 1 hour — editorial copy, aligned with the other content routes. */
export const revalidate = 3600;

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
  const [{ locale }, ingredients, families] = await Promise.all([
    params,
    getIngredientDetails(),
    getIngredientFamilies(),
  ]);

  const dict = await getDictionary(isLocale(locale) ? locale : "en");

  return (
    <div className="min-h-screen bg-background text-ivory">
      {/* ── HERO ───────────────────────────────────── */}
      <section className="relative flex h-[80vh] min-h-150 items-center overflow-hidden bg-black">
        <Image
          src="https://images.unsplash.com/photo-1615885108069-7d5bef9a7e22?w=1800&h=900&fit=crop&auto=format"
          alt=""
          fill
          priority
          quality={85}
          sizes="100vw"
          className="object-cover brightness-20 saturate-60"
        />
        <div className="absolute inset-0 bg-linear-to-br from-background/95 via-background/70 to-background/40" />

        <div className="relative z-10 max-w-3xl px-6 md:px-20 lg:px-30">
          <p className="eyebrow mb-5">{dict.ingredients.hero.eyebrow}</p>
          <h1 className="mb-8 font-heading text-5xl font-normal leading-none text-ivory sm:text-7xl md:text-8xl lg:text-9xl">
            {dict.ingredients.hero.headingLine1}
            <br />
            <span className="text-gold">
              {dict.ingredients.hero.headingLine2}
            </span>
          </h1>
          <div className="gold-line mb-8" />
          <p className="max-w-lg text-sm leading-loose text-ivory/50">
            {dict.ingredients.hero.lede}
          </p>
        </div>
      </section>

      {/* ── FILTER + GRID + DETAIL ──────────────────── */}
      <IngredientExplorer ingredients={ingredients} families={families} />

      {/* ── CTA ─────────────────────────────────────── */}
      <section className="border-t border-border bg-surface px-6 py-24 text-center md:px-20 md:py-30">
        <Reveal className="mx-auto max-w-xl">
          <p className="eyebrow mb-5">{dict.ingredients.cta.eyebrow}</p>
          <h2 className="mb-5 font-heading text-2xl font-normal text-ivory sm:text-3xl md:text-4xl">
            {dict.ingredients.cta.heading}
          </h2>
          <p className="mb-11 text-[13px] leading-loose text-ivory/40">
            {dict.ingredients.cta.lede}
          </p>
          <LocaleLink href="/collections" className="btn-luxury btn-luxury-fill">
            {dict.ingredients.cta.primary}
          </LocaleLink>
        </Reveal>
      </section>
    </div>
  );
}
