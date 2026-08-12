import LocaleLink from "@/src/components/i18n/LocaleLink";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import type { Ingredient } from "@/src/types/content";

/**
 * Key ingredients for a fragrance — Server Component.
 *
 * The rows are derived, never authored per product: `Ingredient.usedIn` already
 * links each material to the perfumes built on it, and the service filters on
 * that. A fragrance with no catalogued material renders nothing at all rather
 * than an empty heading.
 *
 * Each row shows the ingredient's first provenance fact — a single line — not
 * its `description`, which is a full editorial paragraph and belongs on
 * `/ingredients`.
 */

export interface ProductIngredientsProps {
  ingredients: Ingredient[];
  locale: Locale;
}

export default async function ProductIngredients({
  ingredients,
  locale,
}: ProductIngredientsProps) {
  if (ingredients.length === 0) return null;

  const dict = await getDictionary(locale);
  // Ingredient records come from `src/data` — English in both trees.
  const island = ltrIsland(locale);

  return (
    <section>
      <h2 className="eyebrow mb-7">{dict.product.ingredientsHeading}</h2>

      <div className="flex flex-col gap-px">
        {ingredients.map((ingredient) => (
          <LocaleLink
            key={ingredient.id}
            href="/ingredients"
            className="flex flex-col gap-2 bg-surface p-6 no-underline transition-colors duration-300 ease-out hover:bg-card focus-visible:bg-card focus-visible:outline-none sm:flex-row sm:gap-6"
            {...island}
          >
            <div className="sm:w-40 sm:shrink-0">
              <p className="font-heading text-[13px] text-ivory">
                {ingredient.name}
              </p>
              <p className="text-[10px] italic text-ivory/30">
                {ingredient.latinName}
              </p>
              <p className="mt-1 text-[10px] tracking-wide text-gold/60">
                {interpolate(dict.product.ingredientOrigin, {
                  origin: ingredient.origin,
                })}
              </p>
            </div>

            <p className="text-xs leading-relaxed text-ivory/40">
              {ingredient.facts[0]}
            </p>
          </LocaleLink>
        ))}
      </div>
    </section>
  );
}
