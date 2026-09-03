/**
 * The catalogue's filter vocabulary — the `?facet=` view of `/collections`.
 *
 * One row of chips, one parameter. A facet is either a **category** — a shelf
 * the house sells from, and a row in `"Category"` since `0045_category.sql` —
 * or a **merchandising cut** that runs across all of them (new arrivals, best
 * sellers). Both kinds share one control: from the visitor's side "Body Care"
 * and "Best Sellers" are the same gesture, and giving them two rows and two
 * parameters was two names for one idea.
 *
 * The chips cut by category rather than by collection deliberately. A category
 * is what a shopper recognises — "Body Care", not "Body Mist" *and* "Body
 * Cream" — and it means a range added in the dashboard widens an existing chip
 * instead of lengthening the row.
 *
 * ## Linkable, and written by the chips alone
 *
 * The chips write the parameter with `history.replaceState` (see
 * `<CollectionGrid>`), so every narrowed view has a URL to copy or return to.
 * Nothing in the app *links* to one any more — the Nav and the Footer address
 * collection pages, including the two merchandising pages below — but a
 * hand-typed or shared `?facet=` still works, and an unknown value resolves to
 * `null` and shows the whole catalogue rather than an empty grid.
 *
 * A facet is derived, never stored twice: the category cut reads the
 * `categorySlug` the card projection already carries, and the two merchandising
 * cuts read the `NEW_ARRIVAL` tag and the `isBestseller` column that already
 * existed. Combining them happens here and nowhere else — a new category is a
 * row and needs no code at all, and adding a *cut* is an edit to
 * {@link facetVocabulary} and a label in the two dictionaries.
 */

import type { ProductCardData } from "@/src/types/catalog";

/** A cut that crosses the whole catalogue — no shelf can express it. */
export type MerchandisingFacet = "new-arrivals" | "best-sellers";

/**
 * A chip's value: a **category** slug, or one of the two merchandising cuts.
 *
 * A plain `string` rather than the union of seven collection slugs it used to
 * be. That union was written when the seven collections *were* the shelves;
 * since `0045_category.sql` the shelves are `"Category"` rows an editor
 * creates, so the vocabulary is data and the type cannot enumerate it.
 *
 * What replaces the union's guarantee is that the order and the labels arrive
 * together, from the server, in {@link ProductFacetVocabulary} — an unknown
 * value has no chip and no label, so it simply cannot be selected.
 */
export type ProductFacet = string;

/**
 * The chips, in printed order, with their labels.
 *
 * Assembled once per page by `<CollectionView>`: the two merchandising cuts are
 * dictionary copy, the categories in between are rows. Editorial rather than
 * alphabetical, as it always was — the newest goods open the row and best
 * sellers close it.
 */
export interface ProductFacetVocabulary {
  order: readonly ProductFacet[];
  labels: Readonly<Record<string, string>>;
}

/**
 * The two merchandising cuts, in the order they bracket the row.
 *
 * `new-arrivals` opens it and `best-sellers` closes it, with the categories in
 * between — which is where the editorial order lives now that the middle of the
 * row is a table. See {@link facetVocabulary}.
 */
export const NEW_ARRIVALS_FACET = "new-arrivals";
export const BEST_SELLERS_FACET = "best-sellers";

/** The query parameter the cut is carried in, so a filtered view is linkable. */
export const FACET_PARAM = "facet";

/**
 * Every facet a product belongs to.
 *
 * Its category — one shelf, read off the card projection rather than joined for
 * here — plus whichever merchandising cuts its own flags put it in. Derived,
 * never stored twice, exactly as before; what changed is that the middle term is
 * a category rather than a collection, so "Body Care" stays one chip however
 * many ranges the house later sells beneath it.
 */
export function productFacets(product: ProductCardData): ProductFacet[] {
  const facets: ProductFacet[] = [];

  if (product.tags.includes("NEW_ARRIVAL")) facets.push(NEW_ARRIVALS_FACET);
  if (product.categorySlug.length > 0) facets.push(product.categorySlug);
  if (product.isBestseller) facets.push(BEST_SELLERS_FACET);

  return facets;
}

/**
 * The chip row for one page: the two cuts, the categories between them, and a
 * label for each.
 *
 * `categories` arrives already ordered and already resolved to the reader's
 * language, so this is assembly and not a second source of order.
 */
export function facetVocabulary(
  categories: readonly { slug: string; name: string }[],
  merchLabels: Readonly<Record<MerchandisingFacet, string>>,
): ProductFacetVocabulary {
  return {
    order: [
      NEW_ARRIVALS_FACET,
      ...categories.map((category) => category.slug),
      BEST_SELLERS_FACET,
    ],
    labels: {
      [NEW_ARRIVALS_FACET]: merchLabels["new-arrivals"],
      [BEST_SELLERS_FACET]: merchLabels["best-sellers"],
      ...Object.fromEntries(
        categories.map((category) => [category.slug, category.name]),
      ),
    },
  };
}

/**
 * Narrow an untrusted `?facet=` value against this page's vocabulary; anything
 * unknown means "no filter", so a stale or hand-typed URL shows the whole
 * catalogue rather than an empty grid.
 */
export function parseFacet(
  value: string | null | undefined,
  known: readonly ProductFacet[],
): ProductFacet | null {
  if (!value) return null;
  return known.find((facet) => facet === value) ?? null;
}

/**
 * The merchandising cuts that also have a **page** of their own, at
 * `/collections/<facet>`.
 *
 * Best sellers is what the Nav and the Footer link to, and a link out of a menu
 * should land somewhere that looks like a destination — a hero, a name, a
 * count — rather than on the catalogue with a filter silently applied. So it is
 * a page, assembled in `/collections/[slug]` from this list.
 *
 * A list of one, and deliberately still a list: `limited-edition` was the other
 * member until the cut was withdrawn from the catalogue entirely, and the
 * routing, revalidation, sitemap and dashboard machinery around this constant is
 * indifferent to how many entries it holds. Adding a cut back is an entry here,
 * a `MerchPage` row, and a label in the two dictionaries.
 *
 * It cannot be a `Collection` row: a product points at exactly one collection
 * (`"Product"."collectionSlug"`, `supabase/sql/0001_catalog.sql`), so seeding
 * "best sellers" would take those fragrances out of Signature and Noir. The
 * membership rule is `productFacets()` above, which is where it already was.
 *
 * `new-arrivals` is deliberately absent: it has `/new-arrival`, an editorial
 * showroom that prints each release's story and note pyramid in full, which is
 * more than a grid of cards.
 */
export const MERCH_PAGE_FACETS = ["best-sellers"] as const;

export type MerchPageFacet = (typeof MERCH_PAGE_FACETS)[number];

/**
 * Narrow an untrusted `/collections/[slug]` segment to a merchandising page.
 *
 * Called only after the seeded collections have been tried, so a real slug can
 * never be shadowed by one of these.
 */
export function parseMerchPageFacet(slug: string): MerchPageFacet | null {
  return MERCH_PAGE_FACETS.find((facet) => facet === slug) ?? null;
}

/**
 * The one merchandising flag a card prints, or `null`.
 *
 * A product's free-text `badge` outranks this at the call site, because a
 * merchandiser who typed "Most Popular" meant it to be the badge; sold-out
 * stock outranks both, because a card nobody can buy from should not lead with
 * a claim. Only ever one pill — two stacked in one corner of a card is not a
 * design.
 *
 * Deliberately narrower than {@link productFacets}: `new-arrivals` has its own
 * showroom at `/new-arrival` and is announced there rather than on a pill.
 */
export function productFlag(product: ProductCardData): MerchPageFacet | null {
  if (product.isBestseller) return "best-sellers";
  return null;
}
