import Image from "next/image";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import type { Ingredient } from "@/src/types/content";

/** Ingredient card — Server Component. Rendered inside the horizontal rail. */

export interface IngredientCardProps {
  ingredient: Ingredient;
  locale: Locale;
}

export default async function IngredientCard({
  ingredient,
  locale,
}: IngredientCardProps) {
  const dict = await getDictionary(locale);

  return (
    <LocaleLink
      href="/ingredients"
      className="img-zoom group relative w-[260px] flex-none overflow-hidden bg-surface no-underline sm:w-[300px]"
    >
      <div className="relative h-[380px] overflow-hidden">
        <Image
          src={ingredient.image.url}
          alt={ingredient.image.alt}
          fill
          sizes="(min-width: 640px) 300px, 260px"
          className="object-cover brightness-50 saturate-[0.7]"
        />
      </div>
      <div className="border-t border-border p-6">
        {/* Ingredient name and origin come from the database — English only. */}
        <div {...ltrIsland(locale)}>
          <h3 className="mb-1 font-heading text-base font-normal text-ivory">
            {ingredient.name}
          </h3>
        </div>
        <p className="text-xs tracking-wider text-gold/60">
          {interpolate(dict.home.ingredients.from, {
            origin: ingredient.origin,
          })}
        </p>
      </div>
    </LocaleLink>
  );
}
