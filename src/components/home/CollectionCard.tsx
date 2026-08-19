import Image from "next/image";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { readingArrow } from "@/src/lib/i18n/rtl";
import type { Collection } from "@/src/types/catalog";

/** Collection card — Server Component. Used by the two-up collections grid. */

export interface CollectionCardProps {
  collection: Collection;
  /** Roman ordinal shown above the title, e.g. "Collection I". */
  ordinal: string;
  locale: Locale;
  /**
   * The Noir collection is graded darker than Signature. Kept as an explicit
   * prop rather than branching on the slug, so a third collection can pick a
   * treatment without editing this component.
   */
  tone?: "standard" | "dark";
}

const IMAGE_TONE = {
  standard: "brightness-[0.55] saturate-[0.8] group-hover:brightness-[0.65]",
  dark: "brightness-[0.4] saturate-[0.6] group-hover:brightness-[0.5]",
} as const;

const OVERLAY_TONE = {
  standard: "from-background/90",
  dark: "from-black/95",
} as const;

export default async function CollectionCard({
  collection,
  ordinal,
  locale,
  tone = "standard",
}: CollectionCardProps) {
  const dict = await getDictionary(locale);

  return (
    <LocaleLink
      href={`/collections/${collection.slug}`}
      className="img-zoom group relative block aspect-3/4 overflow-hidden bg-surface no-underline"
    >
      <Image
        src={collection.cardUrl}
        alt={collection.cardAlt}
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        className={`object-cover transition-[filter] duration-700 ease-out ${IMAGE_TONE[tone]}`}
      />

      <div
        className={`absolute inset-0 flex flex-col justify-end bg-linear-to-t ${OVERLAY_TONE[tone]} via-transparent to-transparent p-8 md:p-12`}
      >
        <p className="eyebrow mb-3">{ordinal}</p>
        {/*
          `dir="auto"` rather than an LTR island: the category collections carry
          an Arabic name and every description is translated, while the house
          ranges (Signature, Noir, Gemstone) fall back to their Latin name —
          which the first strong character resolves correctly either way.
        */}
        <h3
          dir="auto"
          className="mb-5 font-heading text-3xl font-normal text-ivory md:text-4xl"
        >
          {collection.name}
        </h3>
        <p
          dir="auto"
          className="mb-8 max-w-md text-xs leading-relaxed text-ivory/50 md:text-sm"
        >
          {collection.description}
        </p>
        <span className="font-heading text-[11px] uppercase tracking-[0.2em] text-gold transition-transform duration-300 ease-out group-hover:translate-x-1 rtl:group-hover:-translate-x-1">
          {dict.common.explore} {readingArrow(locale)}
        </span>
      </div>
    </LocaleLink>
  );
}
