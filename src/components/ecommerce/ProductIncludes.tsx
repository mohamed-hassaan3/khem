import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { ltrIsland } from "@/src/lib/i18n/rtl";

/**
 * What a set contains — Server Component.
 *
 * The one block `/set/[slug]` adds that no other detail page has, and the
 * reason the sets needed a page at all: a discovery set is bought for its
 * contents, and until now that list existed only as three cramped lines on a
 * card.
 *
 * ## Free text, not a join
 *
 * `Product.includes` is `text[]` (`supabase/sql/0001_catalog.sql`), and the
 * schema states why: "a discovery vial is not a sellable SKU, so there is
 * nothing to point at". A 2ml vial of Onyx Night has no product row, no price
 * and no inventory — it exists only inside the box — so the rows here are
 * deliberately *not* links. Making them links would mean inventing SKUs for
 * things that cannot be bought separately.
 *
 * A gift set's contents are the same shape for the opposite reason: what makes
 * it a gift is the composition, and the box is the unit of sale.
 *
 * ## Register
 *
 * Numbered rows on a hairline grid, matching `<ProductPyramid>`'s three tiers
 * rather than `<ProductIngredients>`'s cards — a contents list is an inventory
 * of one object, not a set of links out to other pages. The numeral is
 * decorative and hidden from assistive technology, which reads the list as the
 * ordered list it is.
 */

export interface ProductIncludesProps {
  /** `Product.includes`, already localised by the service layer. */
  includes: readonly string[];
  locale: Locale;
}

export default async function ProductIncludes({
  includes,
  locale,
}: ProductIncludesProps) {
  // Self-guarding, like `<ProductIngredients>`: a set with nothing listed
  // renders nothing rather than an empty heading. The caller then needs no
  // guard of its own, and cannot leave an empty gap row behind.
  if (includes.length === 0) return null;

  const dict = await getDictionary(locale);
  // Catalog copy — the fragrance names inside a set are Latin in both trees.
  const island = ltrIsland(locale);

  return (
    <section>
      <h2 className="eyebrow mb-7">{dict.product.includesHeading}</h2>

      <ol className="flex flex-col gap-px">
        {includes.map((item, index) => (
          <li
            key={item}
            className="card flex items-baseline gap-5 p-5 sm:gap-6 sm:p-6"
          >
            <span
              aria-hidden="true"
              className="shrink-0 font-heading text-[11px] tracking-[0.2em] text-ground-subtle"
            >
              {/* Two digits, so a ten-piece set does not reflow the column. */}
              {String(index + 1).padStart(2, "0")}
            </span>

            <p
              {...island}
              className="text-[13px] leading-relaxed text-ground sm:text-sm"
            >
              {item}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
