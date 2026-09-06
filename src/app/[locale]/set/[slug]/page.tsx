import type { Metadata } from "next";
import { notFound } from "next/navigation";

import NavGround from "@/src/components/NavGround";
import Reveal from "@/src/components/animation/Reveal";
import ProductBreadcrumb from "@/src/components/ecommerce/ProductBreadcrumb";
import ProductComments from "@/src/components/ecommerce/ProductComments";
import ProductGallery from "@/src/components/ecommerce/ProductGallery";
import ProductIncludes from "@/src/components/ecommerce/ProductIncludes";
import ProductPurchase from "@/src/components/ecommerce/ProductPurchase";
import ProductStory from "@/src/components/ecommerce/ProductStory";
import RelatedProducts from "@/src/components/ecommerce/RelatedProducts";
import { LOCALES, isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { getBenefitSettings } from "@/src/services/benefits";
import {
  SET_RELATED_KINDS,
  getCollectionBySlug,
  getRelatedProductCards,
  getSetProductBySlug,
  getSetProductSlugs,
} from "@/src/services/products";

/** ISR, 1 hour — the same as `/perfume/[slug]` and `/ritual/[slug]`, for the reason given there. */
export const revalidate = 3600;

/**
 * Prerender every locale × set pair. Without it the `[slug]` segment would
 * force the route into dynamic rendering.
 */
export async function generateStaticParams() {
  const slugs = await getSetProductSlugs();

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
    getSetProductBySlug(activeLocale, slug),
  ]);

  // An unknown slug renders the 404 below; its metadata falls back to the
  // section's rather than echoing the requested segment back into the page.
  if (!product) {
    return localeMetadata({
      locale: activeLocale,
      path: "/collections",
      title: dict.set.meta.title,
      description: dict.set.meta.description,
    });
  }

  return localeMetadata({
    locale: activeLocale,
    path: `/set/${product.slug}`,
    title: product.name,
    description: product.description,
    ogTitle: `${product.name} | KHEM`,
    ogDescription: product.description,
  });
}

/**
 * Discovery and gift sets, one composition at a time.
 *
 * ## Why this route exists
 *
 * The sets were the only goods in the catalogue with no page. They sold
 * straight from `<DiscoverySetCard>`, which meant the contents of a box — the
 * whole reason anyone buys one — appeared as three cramped lines in a grid
 * cell, and a cart line for a set linked back to the grid it came from rather
 * than to the thing that was bought. §26 and §27 of the redesign brief ask for
 * exactly this: sets treated as real products.
 *
 * ## What it is, and what it deliberately is not
 *
 * Section for section this is `/ritual/[slug]`: breadcrumb, gallery, buy block,
 * story, thread, related rail. Two differences, both about the goods:
 *
 *  - `<ProductIncludes>` replaces `<ProductIngredients>`. A set has no
 *    catalogued materials of its own — it has contents, which is a different
 *    claim, and the only block on the site that is unique to this page.
 *  - No `<ProductPyramid>`. A set carries no note tiers; it contains things
 *    that do.
 *
 * A separate route rather than a fourth branch inside the perfume page, for the
 * reason `/ritual/[slug]` gives: the queries are scoped to different kinds on
 * purpose, so no URL space can render another's goods.
 * `getSetProductBySlug()` 404s a fragrance slug here exactly as
 * `getProductBySlug()` 404s a set slug there — enforced at the query, not just
 * in `productHref()`.
 */
export default async function SetPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  // The segment is untrusted input: it is only ever matched against seeded
  // slugs, and an unknown value 404s rather than falling back to a product the
  // visitor did not ask for.
  const product = await getSetProductBySlug(activeLocale, slug);
  if (!product) notFound();

  const [dict, collection, related, benefits] = await Promise.all([
    getDictionary(activeLocale),
    getCollectionBySlug(activeLocale, product.collectionSlug),
    /*
     * The rail draws from the fragrances as well as the other sets, so a
     * discovery box can offer a full bottle of something it introduced. The
     * kinds are a module constant, never anything derived from the request.
     */
    getRelatedProductCards(activeLocale, product.slug, 4, SET_RELATED_KINDS),
    getBenefitSettings(),
  ]);

  const gallery = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);

  /*
   * The collection is the only thing carrying the kind — `Product` stores a
   * `collectionSlug`, not a kind — and it decides one line of copy. A failed
   * read leaves the page fully renderable on the discovery wording rather than
   * dropping the eyebrow.
   */
  const kind = collection?.kind === "GIFT" ? "GIFT" : "DISCOVERY";

  return (
    <div className="ground-ivory min-h-screen">
      {/* §13: the product needs room and light. */}
      <NavGround ground="ivory" />
      <ProductBreadcrumb
        locale={activeLocale}
        collection={collection}
        productName={product.name}
      />

      <section className="grid grid-cols-1 lg:grid-cols-2">
        <ProductGallery images={gallery} productName={product.name} />

        <div className="flex max-w-2xl flex-col gap-7 md:gap-16 px-4 py-14 sm:px-8 lg:px-14 lg:py-20 xl:px-20">
          {/* Which of the two kinds of box this is — the one thing this page
              says that the ritual page does not. */}
          <p className="eyebrow -mb-10 text-ground-accent/55">
            {dict.set.eyebrow[kind]}
          </p>

          <ProductPurchase
            product={product}
            collectionName={collection?.name ?? "KHEM"}
            locale={activeLocale}
          />

          {/*
            The Discovery promise, on the detail page as well as on the banner.
            
            Two conditions, and both are necessary. `kind` keeps it off a **gift**
            set, which earns no credit; `discoveryCreditEnabled` keeps it off
            every page once the house withdraws the benefit. When either fails
            nothing is rendered — not an empty paragraph — so the column's `gap`
            closes over it and the story block moves up.
          */}
          {kind === "DISCOVERY" && benefits.discoveryCreditEnabled ? (
            <p className="-mt-6 border-s-2 border-gold/40 ps-4 text-[13px] leading-relaxed text-ground-muted md:-mt-12">
              {dict.discovery.note}
            </p>
          ) : null}

          {/* The block this page exists for. Self-guarding on an empty list. */}
          <Reveal>
            <ProductIncludes
              includes={product.includes}
              locale={activeLocale}
            />
          </Reveal>

          {product.story ? (
            <Reveal>
              <ProductStory
                story={product.story}
                heading={dict.product.storyHeading}
              />
            </Reveal>
          ) : null}

          {/* No `<ProductPyramid>` and no `<ProductIngredients>`: a set carries
              no note tiers and no catalogued materials — it contains things
              that do. */}
        </div>
      </section>

      {/* Self-guarding: renders nothing when the database is unconfigured, and
          no empty panel when nobody has written yet. Its own `Reveal` sits
          inside, after that guard. */}
      <ProductComments slug={product.slug} locale={activeLocale} />

      <RelatedProducts products={related} locale={activeLocale} />
    </div>
  );
}
