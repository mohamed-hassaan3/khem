"use client";

import Image from "next/image";
import { useState } from "react";

import { interpolate } from "@/src/lib/i18n/interpolate";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { ProductImage } from "@/src/types/catalog";

/**
 * Product gallery — the only state on this page's left column.
 *
 * Frames are stacked and cross-faded on `opacity` alone: swapping `src` on a
 * single element would flash, and animating anything but opacity would shift
 * the layout of a column that is sticky for the whole scroll.
 */

export interface ProductGalleryProps {
  images: ProductImage[];
  /** Fallback alt text for a record that shipped without one. */
  productName: string;
}

const SIZES = "(min-width: 1024px) 50vw, 100vw";

export default function ProductGallery({
  images,
  productName,
}: ProductGalleryProps) {
  const dict = useDictionary();
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="flex w-full flex-col overflow-hidden bg-card lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)]">
      <div className="relative aspect-4/5 w-full overflow-hidden lg:aspect-auto lg:flex-1">
        {images.map((image, index) => (
          <Image
            key={image.url}
            src={image.url}
            alt={image.alt || productName}
            fill
            priority={index === 0}
            quality={85}
            sizes={SIZES}
            className={`object-cover brightness-90 transition-opacity duration-700 ease-out ${
              index === activeIndex ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>

      {images.length > 1 ? (
        <div className="flex gap-px bg-background p-px">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              aria-current={index === activeIndex ? "true" : undefined}
              aria-label={interpolate(dict.product.gallery.thumbnail, {
                index: index + 1,
                total: images.length,
              })}
              onClick={() => setActiveIndex(index)}
              className={`relative h-20 flex-1 overflow-hidden outline-2 -outline-offset-2 transition-[outline-color] duration-300 ease-out focus-visible:outline-gold ${
                index === activeIndex ? "outline-gold" : "outline-transparent"
              }`}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="120px"
                className="object-cover brightness-75"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
