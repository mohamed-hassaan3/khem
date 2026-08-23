import LocaleLink from "@/src/components/i18n/LocaleLink";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import type { ScentProfileSlug } from "@/src/lib/scent-profiles";

/**
 * The scent profile of a fragrance — Server Component.
 *
 * One line, one or two chips: *this is what it smells of, in the vocabulary a
 * customer asks in.* It answers the question the note pyramid above it does not,
 * because a pyramid names nine materials and a shopper wants one word.
 *
 * Derived, never authored per product: the page reads it off the materials the
 * perfume is actually built on with `productScentProfiles()` — the same
 * `getIngredientsForProduct()` payload `<ProductIngredients>` renders — so a
 * recatalogued ingredient moves this line and the profile pages together. See
 * `src/lib/scent-profiles.ts` for why the answer is capped at two.
 *
 * The derivation is the page's rather than this component's so the call site can
 * skip the `<Reveal>` wrapper entirely on a fragrance with no catalogued
 * material: an empty `<Reveal>` still occupies a gap row in the column.
 *
 * Each chip is a link to that profile's page: a visitor who has just learned
 * they like woody fragrances is one click from the rest of them, which is the
 * entire reason the profile pages exist.
 *
 * Renders nothing on an empty list all the same — a heading over an empty row
 * would be worse than silence, whichever side forgot to check.
 */

export interface ProductScentProfileProps {
  /** One, or two at the most — see `productScentProfiles()`. */
  profiles: ScentProfileSlug[];
  locale: Locale;
}

export default async function ProductScentProfile({
  profiles,
  locale,
}: ProductScentProfileProps) {
  if (profiles.length === 0) return null;

  const dict = await getDictionary(locale);

  return (
    <section>
      <h2 className="eyebrow mb-5">{dict.product.scentProfileHeading}</h2>

      <div className="flex flex-wrap gap-3">
        {profiles.map((profile) => (
          <LocaleLink
            key={profile}
            href={`/collections/${profile}`}
            /*
             * The `<FilterChip>` treatment from `<CollectionGrid>`, in its
             * resting state — the two are the same object seen twice, and a
             * visitor arriving at `/collections/woody` from here should
             * recognise the chip they pressed.
             */
            className="border border-gold/30 px-4 py-2 font-heading text-[10px] uppercase tracking-[0.2em] text-gold/80 no-underline transition-colors duration-300 ease-out hover:border-gold/70 hover:bg-gold/10 hover:text-gold focus-visible:border-gold focus-visible:text-gold focus-visible:outline-none"
            dir="auto"
          >
            {dict.collections.scentProfiles[profile].name}
          </LocaleLink>
        ))}
      </div>
    </section>
  );
}
