import type { Metadata } from "next";
import { notFound } from "next/navigation";

import NavGround from "@/src/components/NavGround";
import ChromeMarker from "@/src/components/layout/ChromeMarker";
import DeliveryReturnsNote from "@/src/components/ecommerce/DeliveryReturnsNote";
import ProductAccordion from "@/src/components/ecommerce/ProductAccordion";
import ProductBreadcrumb from "@/src/components/ecommerce/ProductBreadcrumb";
import ProductComments from "@/src/components/ecommerce/ProductComments";
import ProductGallery from "@/src/components/ecommerce/ProductGallery";
import ProductIngredients from "@/src/components/ecommerce/ProductIngredients";
import ProductPurchase from "@/src/components/ecommerce/ProductPurchase";
import ProductPyramid from "@/src/components/ecommerce/ProductPyramid";
import ProductScentProfile from "@/src/components/ecommerce/ProductScentProfile";
import ProductStory from "@/src/components/ecommerce/ProductStory";
import RelatedProducts from "@/src/components/ecommerce/RelatedProducts";
import { LOCALES, isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { jsonLdHtml } from "@/src/lib/json-ld";
import { productGraph } from "@/src/lib/structured-data";
import { SCENT_PROFILE_SLUGS } from "@/src/lib/scent-profiles";
import { getProductRatingSummary } from "@/src/services/comments";
import { getIngredientsForProduct } from "@/src/services/content";
import {
  getCollectionBySlug,
  getProductBySlug,
  getProductSlugs,
  getProductScentProfileSlugs,
  getRelatedProductCards,
} from "@/src/services/products";

/**
 * ISR, 1 hour — a backstop, not the freshness mechanism.
 *
 * `src/lib/admin/revalidate.ts` re-renders this page on the catalog write that
 * changes it, `src/actions/checkout.ts` re-renders it when a sale moves the
 * stock, and `src/actions/comments.ts` when a visitor writes on it. The window
 * only has to catch what none of those announce.
 *
 * The window was five minutes. At this site's traffic a page is requested far less often
 * than that, so nearly every request landed past the window and paid for a
 * regeneration: ISR writes tracked page views one-for-one and ran over the
 * Vercel allowance. A short window only pays for itself under traffic dense
 * enough to amortise it. See `prompts/vercel-usage-reduction.md`.
 */
export const revalidate = 3600;

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

  const [dict, collection, related, ingredients, productProfileSlugs, rating] =
    await Promise.all([
      getDictionary(activeLocale),
      getCollectionBySlug(activeLocale, product.collectionSlug),
      getRelatedProductCards(activeLocale, product.slug),
      getIngredientsForProduct(product.slug, activeLocale),
      getProductScentProfileSlugs(product.slug),
      // Memoised: `<ProductComments>` reads the same summary in this request.
      getProductRatingSummary(product.slug),
    ]);

  const gallery = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);

  // One word for the whole bottle, or two — read off the materials it is built
  // on. Empty for a fragrance with nothing catalogued, which drops the section.
  const scentProfiles = SCENT_PROFILE_SLUGS.filter((profile) => productProfileSlugs.includes(profile));

  const tiers = [
    { label: dict.product.topNotes, notes: product.topNotes },
    { label: dict.product.heartNotes, notes: product.heartNotes },
    { label: dict.product.baseNotes, notes: product.baseNotes },
  ];

  /*
   * The breadcrumb trail, built from the same three values `<ProductBreadcrumb>`
   * renders below — Home → Collections → collection → product.
   *
   * Assembled here and passed into the markup rather than derived from the URL,
   * because Google requires that a `BreadcrumbList` describe the trail the
   * reader can actually see. Sharing the inputs is what stops the two drifting:
   * a collection that fails to resolve drops out of both at once.
   */
  const crumbs = [
    { name: dict.product.home, path: "/" },
    { name: dict.product.collections, path: "/collections" },
    ...(collection
      ? [{ name: collection.name, path: `/collections/${collection.slug}` }]
      : []),
    { name: product.name, path: `/perfume/${product.slug}` },
  ];

  return (
    <div className="ground-ivory min-h-screen">
      {/*
       * `Product`, its `Offer`, and the trail above it.
       *
       * The price is the stored EGP figure — never a display-currency
       * conversion, which would advertise a price the checkout will not honour.
       * See `src/lib/structured-data.ts` for the full reasoning, including why
       * no rating markup is emitted from the comments feature.
       */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdHtml(
          productGraph({ locale: activeLocale, product, crumbs }),
        )}
      />

      {/* §13: the product needs room and light. The story block below keeps
          its own dark ground. */}
      <NavGround
        ground="ivory"
        backHref={collection ? `/collections/${collection.slug}` : "/collections"}
        backLabel={collection?.name ?? dict.nav.collections}
      />
      <ChromeMarker kind="purchase" />
      {/*
        Stage 2 (`prompts/storefront-redesign-stage-2.md` D7/D8). Phone: the
        gallery runs full bleed under the 56px header (the back chevron
        replaces the breadcrumb), then the buy block, the fragrance, and the
        long reads folded into rows. Desktop: breadcrumb, then a two-column
        grid in a max-width container, the gallery sticky beside the details.
      */}
      <ProductBreadcrumb
        locale={activeLocale}
        collection={collection}
        productName={product.name}
      />

      <section className="lg:mx-auto lg:grid lg:max-w-350 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14 lg:px-12 lg:pb-8 lg:pt-8 xl:gap-20">
        <ProductGallery images={gallery} productName={product.name} />

        <div className="flex flex-col gap-7 px-4 pt-5 sm:px-8 lg:max-w-130 lg:px-0 lg:pt-0">
          <ProductPurchase
            product={product}
            collectionName={collection?.name ?? "KHEM"}
            locale={activeLocale}
            rating={rating}
          />

          <div className="flex flex-col gap-3">
            <ProductPyramid tiers={tiers} heading={dict.product.pyramidHeading} />
            {scentProfiles.length > 0 ? (
              <ProductScentProfile
                profiles={scentProfiles}
                locale={activeLocale}
              />
            ) : null}
          </div>

          <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
            {product.story ? (
              <ProductAccordion title={dict.product.storyHeading} defaultOpen>
                <ProductStory
                  story={product.story}
                  heading={dict.product.storyHeading}
                  showHeading={false}
                />
              </ProductAccordion>
            ) : null}

            {ingredients.length > 0 ? (
              <ProductAccordion
                title={
                  ingredients.length === 1
                    ? interpolate(dict.product.keyIngredient, {
                        name: ingredients[0].name,
                      })
                    : dict.product.ingredientsHeading
                }
              >
                <ProductIngredients
                  ingredients={ingredients}
                  locale={activeLocale}
                  showHeading={false}
                />
              </ProductAccordion>
            ) : null}

            <ProductAccordion title={dict.product.deliveryReturns}>
              <DeliveryReturnsNote />
            </ProductAccordion>
          </div>
        </div>
      </section>

      <ProductComments slug={product.slug} locale={activeLocale} />

      <RelatedProducts products={related} locale={activeLocale} />
    </div>
  );
}
