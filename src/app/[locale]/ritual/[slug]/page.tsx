import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Reveal from "@/src/components/animation/Reveal";
import ProductBreadcrumb from "@/src/components/ecommerce/ProductBreadcrumb";
import ProductComments from "@/src/components/ecommerce/ProductComments";
import ProductGallery from "@/src/components/ecommerce/ProductGallery";
import ProductIngredients from "@/src/components/ecommerce/ProductIngredients";
import ProductPurchase from "@/src/components/ecommerce/ProductPurchase";
import ProductStory from "@/src/components/ecommerce/ProductStory";
import RelatedProducts from "@/src/components/ecommerce/RelatedProducts";
import { LOCALES, isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { getIngredientsForProduct } from "@/src/services/content";
import {
  RITUAL_RELATED_KINDS,
  getCollectionBySlug,
  getRelatedProductCards,
  getRitualProductBySlug,
  getRitualProductSlugs,
} from "@/src/services/products";

/** ISR, 5 minutes — the same as `/perfume/[slug]`, per AGENTS.md §8. */
export const revalidate = 300;

/**
 * Prerender every locale × product pair. Without it the `[slug]` segment would
 * force the route into dynamic rendering.
 */
export async function generateStaticParams() {
  const slugs = await getRitualProductSlugs();

  return LOCALES.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

type RouteParams = { locale: string; slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [dict, product] = await Promise.all([
    getDictionary(activeLocale),
    getRitualProductBySlug(activeLocale, slug),
  ]);

  // An unknown slug renders the 404 below; its metadata falls back to the
  // section's rather than echoing the requested segment back into the page.
  if (!product) {
    return localeMetadata({
      locale: activeLocale,
      path: "/collections",
      title: dict.ritual.meta.title,
      description: dict.ritual.meta.description,
    });
  }

  return localeMetadata({
    locale: activeLocale,
    path: `/ritual/${product.slug}`,
    title: product.name,
    description: product.description,
    ogTitle: `${product.name} | KHEM`,
    ogDescription: product.description,
  });
}

/**
 * Body care and home fragrance, one product at a time.
 *
 * Deliberately the same page as `/perfume/[slug]`, section for section — the
 * gallery, the buy block, the story, the key ingredients, the thread, the
 * related rail — with the **fragrance pyramid** as the single omission. A body
 * mist stores no note tiers (`topNotes` and its siblings are empty for every
 * one of these products), so a pyramid here would be three empty rows under a
 * heading.
 *
 * That it is a separate route rather than a branch inside the perfume page is
 * the same reasoning as `<CategoryView>` beside `<CollectionView>`: the two
 * queries are scoped to different kinds on purpose, so neither URL space can
 * render the other's goods. `getRitualProductBySlug()` 404s a fragrance slug
 * here exactly as `getProductBySlug()` 404s a body-mist slug there.
 */
export default async function RitualPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  // The segment is untrusted input: it is only ever matched against seeded
  // slugs, and an unknown value 404s rather than falling back to a product the
  // visitor did not ask for.
  const product = await getRitualProductBySlug(activeLocale, slug);
  if (!product) notFound();

  const [dict, collection, related, ingredients] = await Promise.all([
    getDictionary(activeLocale),
    getCollectionBySlug(activeLocale, product.collectionSlug),
    /*
     * The rail draws from the fragrances as well as the ritual goods, so a body
     * mist can offer the eau de parfum it shares a heart with. The kinds are a
     * module constant, never anything derived from the request.
     */
    getRelatedProductCards(activeLocale, product.slug, 3, RITUAL_RELATED_KINDS),
    getIngredientsForProduct(product.slug),
  ]);

  const gallery = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);

  /*
   * The collection is the only thing carrying the kind — `Product` stores a
   * `collectionSlug`, not a kind — and it decides one line of copy. A failed
   * read leaves the page fully renderable on the body-care wording rather than
   * dropping the eyebrow.
   */
  const kind = collection?.kind === "HOME" ? "HOME" : "BODY";

  return (
    /* `pt-20` clears the fixed 5rem Nav — this page opens on a bar, not a hero. */
    <div className="min-h-screen bg-background pt-20 text-ivory">
      <ProductBreadcrumb
        locale={activeLocale}
        collection={collection}
        productName={product.name}
      />

      <section className="grid grid-cols-1 lg:grid-cols-2">
        <ProductGallery images={gallery} productName={product.name} />

        <div className="flex max-w-2xl flex-col gap-7 md:gap-16 px-4 py-14 sm:px-8 lg:px-14 lg:py-20 xl:px-20">
          {/* The one thing this page says that the perfume page does not: which
              of the two ranges the object belongs to. */}
          <p className="eyebrow -mb-10 text-gold/55">
            {dict.ritual.eyebrow[kind]}
          </p>

          <ProductPurchase
            product={product}
            collectionName={collection?.name ?? "KHEM"}
            locale={activeLocale}
          />

          {product.story ? (
            <Reveal>
              <ProductStory
                story={product.story}
                heading={dict.product.storyHeading}
              />
            </Reveal>
          ) : null}

          {/* No `<ProductPyramid>`: these goods carry no note tiers. */}

          {/* Guarded here too: an empty <Reveal> would still occupy a gap row. */}
          {ingredients.length > 0 ? (
            <Reveal>
              <ProductIngredients
                ingredients={ingredients}
                locale={activeLocale}
              />
            </Reveal>
          ) : null}
        </div>
      </section>

      {/* Self-guarding, like `<ProductIngredients>`: renders nothing when the
          database is unconfigured, and no empty panel when nobody has written
          yet. Its own `Reveal` sits inside, after that guard. */}
      <ProductComments slug={product.slug} locale={activeLocale} />

      <RelatedProducts products={related} locale={activeLocale} />
    </div>
  );
}
