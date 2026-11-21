import Reveal from "@/src/components/animation/Reveal";
import ProductCard from "@/src/components/ecommerce/ProductCard";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * "You may also love" — Server Component.
 *
 * Renders the existing `<ProductCard>` rather than a detail-page variant, so
 * the card design is never forked. The service decides which fragrances appear;
 * this component only lays them out.
 */

export interface RelatedProductsProps {
  products: ProductCardData[];
  locale: Locale;
}

const CARD_SIZES = "(min-width: 1024px) 33vw, 50vw";

export default async function RelatedProducts({
  products,
  locale,
}: RelatedProductsProps) {
  if (products.length === 0) return null;

  const dict = await getDictionary(locale);

  return (
    <section className="px-4 pb-14 pt-9 sm:px-6 md:px-10 md:pb-28 md:pt-20 lg:px-12 xl:px-16">
      <div className="mx-auto max-w-350">
        <Reveal className="mb-3 md:mb-10 md:text-center">
          <p className="eyebrow md:mb-4">{dict.product.related.eyebrow}</p>
          <h2 className="hidden font-heading text-3xl font-normal text-ground sm:text-4xl md:block">
            {dict.product.related.heading}
          </h2>
        </Reveal>

        <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              locale={locale}
              sizes={CARD_SIZES}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
