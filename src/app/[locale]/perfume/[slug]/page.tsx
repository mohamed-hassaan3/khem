import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Reveal from "@/src/components/animation/Reveal";
import ProductBreadcrumb from "@/src/components/ecommerce/ProductBreadcrumb";
import ProductComments from "@/src/components/ecommerce/ProductComments";
import ProductGallery from "@/src/components/ecommerce/ProductGallery";
import ProductIngredients from "@/src/components/ecommerce/ProductIngredients";
import ProductPurchase from "@/src/components/ecommerce/ProductPurchase";
import ProductPyramid from "@/src/components/ecommerce/ProductPyramid";
import ProductStory from "@/src/components/ecommerce/ProductStory";
import RelatedProducts from "@/src/components/ecommerce/RelatedProducts";
import { LOCALES, isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { getIngredientsForProduct } from "@/src/services/content";
import {
  getCollectionBySlug,
  getProductBySlug,
  getProductSlugs,
  getRelatedProductCards,
} from "@/src/services/products";

/** ISR, 5 minutes — AGENTS.md §8 routing matrix. */
export const revalidate = 300;

/**
 * Prerender every locale × product pair. Without it the `[slug]` segment would
 * force the route into dynamic rendering.
 */
export async function generateStaticParams() {
  const slugs = await getProductSlugs();

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
    getProductBySlug(activeLocale, slug),
  ]);

  // An unknown slug renders the 404 below; its metadata falls back to the
  // catalog's rather than echoing the requested segment back into the page.
  if (!product) {
    return localeMetadata({
      locale: activeLocale,
      path: "/collections",
      title: dict.collections.meta.title,
      description: dict.collections.meta.description,
    });
  }

  return localeMetadata({
    locale: activeLocale,
    path: `/perfume/${product.slug}`,
    title: product.name,
    description: product.description,
    ogTitle: `${product.name} | KHEM`,
    ogDescription: product.description,
  });
}

/** Product detail page. */
export default async function PerfumePage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  // The segment is untrusted input: it is only ever matched against seeded
  // slugs, and an unknown value 404s rather than falling back to a product the
  // visitor did not ask for.
  const product = await getProductBySlug(activeLocale, slug);
  if (!product) notFound();

  const [dict, collection, related, ingredients] = await Promise.all([
    getDictionary(activeLocale),
    getCollectionBySlug(activeLocale, product.collectionSlug),
    getRelatedProductCards(activeLocale, product.slug),
    getIngredientsForProduct(product.slug),
  ]);

  const gallery = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);

  const tiers = [
    { label: dict.product.topNotes, notes: product.topNotes },
    { label: dict.product.heartNotes, notes: product.heartNotes },
    { label: dict.product.baseNotes, notes: product.baseNotes },
  ];

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

        <div className="flex max-w-2xl flex-col gap-16 px-6 py-14 sm:px-8 lg:px-14 lg:py-20 xl:px-20">
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

          <Reveal>
            <ProductPyramid tiers={tiers} heading={dict.product.pyramidHeading} />
          </Reveal>

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
