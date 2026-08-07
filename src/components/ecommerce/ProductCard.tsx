import Image from "next/image";
import Link from "next/link";

import { formatPrice, formatVolume } from "@/src/lib/format";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * Product card — Server Component.
 *
 * Takes the narrow `ProductCardData` projection rather than a full `Product`, so
 * the list query never has to over-select.
 */

export interface ProductCardProps {
  product: ProductCardData;
  /** Drives the `sizes` hint; the grid is 1 → 2 → 4 columns. */
  sizes?: string;
}

const DEFAULT_SIZES =
  "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw";

export default function ProductCard({
  product,
  sizes = DEFAULT_SIZES,
}: ProductCardProps) {
  // Display order is top → heart → base, matching the pyramid.
  const notes = [
    ...product.topNotes,
    ...product.heartNotes,
    ...product.baseNotes,
  ];

  return (
    <Link
      href={`/perfume/${product.slug}`}
      className="img-zoom group relative block overflow-hidden bg-surface no-underline"
    >
      <div className="relative aspect-3/4 overflow-hidden bg-card">
        <Image
          src={product.primaryImage.url}
          alt={product.primaryImage.alt}
          fill
          sizes={sizes}
          className="object-cover brightness-75"
        />
      </div>

      <div className="p-6">
        <p className="mb-2 text-[9px] uppercase tracking-[0.2em] text-gold/60">
          {product.collectionName} Collection
        </p>
        <h3 className="mb-1 font-heading text-base font-normal tracking-wider text-ivory">
          {product.name}
        </h3>
        {product.subtitle ? (
          <p className="mb-4 text-xs tracking-wide text-ivory/40">
            {product.subtitle}
          </p>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-1.5">
          {notes.map((note) => (
            <span
              key={note}
              className="border border-gold/20 bg-gold/5 px-2 py-0.5 text-[9px] tracking-widest text-gold/70"
            >
              {note}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="font-heading text-sm text-gold">
            {formatPrice(product.priceInCents)}
          </span>
          <span className="text-[10px] uppercase tracking-[0.15em] text-ivory/40">
            {formatVolume(product.volumeMl)}
          </span>
        </div>
      </div>
    </Link>
  );
}
