import Image from "next/image";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import type { Collection } from "@/src/types/catalog";

/**
 * One collection in the home page's phone rail (Stage 2 D4): a 132px portrait
 * card, its name, and how many pieces it holds. The count comes from the same
 * read as the collection (`getFeaturedCollections`); a collection without one
 * shows its one-line description instead.
 */
export default async function CollectionRailCard({
  collection,
  locale,
  priority = false,
}: {
  collection: Collection;
  locale: Locale;
  priority?: boolean;
}) {
  const dict = await getDictionary(locale);
  const count = collection.productCount;

  return (
    <LocaleLink
      href={`/collections/${collection.slug}`}
      className="group block w-33 shrink-0 snap-start text-ground no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent"
    >
      <div className="relative h-40 overflow-hidden rounded-md bg-sand">
        <Image
          src={collection.cardUrl}
          alt={collection.cardAlt}
          fill
          sizes="132px"
          loading={priority ? "eager" : "lazy"}
          className="object-cover"
        />
      </div>
      <p dir="auto" className="mt-2 truncate font-heading text-[13px]">
        {collection.name}
      </p>
      <p dir="auto" className="mt-0.5 truncate text-[11px] text-ground-muted">
        {count === undefined
          ? collection.subdescription
          : count === 1
            ? dict.home.collections.piecesOne
            : interpolate(dict.home.collections.pieces, { count })}
      </p>
    </LocaleLink>
  );
}
