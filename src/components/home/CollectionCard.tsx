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

/*
 * Noir's photography is graded darker than the rest, so it is *lifted* rather
 * than dimmed — the same `brightness-105` treatment its collection banner takes
 * in `<CollectionView>`, so the two agree about what NOIR looks like.
 *
 * Everything else runs untouched. These were `brightness-[0.55]` and
 * `brightness-[0.4]` under a near-opaque black gradient: the last fully dark
 * surface left in the customer app, on the home page, at a moment when its own
 * captions had already become charcoal on an ivory card. The dimming was making
 * the photograph worse and the caption no better.
 */
const IMAGE_TONE = {
  standard: "",
  dark: "brightness-105",
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
      /*
        `ground-ivory`, declared rather than inherited. The type sits on the
        photograph under the house banner scrim, so the ground it needs is the
        scrim's — and the scrim is ivory, which makes the caption charcoal.
        Stating it also keeps the card correct if the section around it ever
        changes ground.
      */
      className="ground-ivory img-zoom group relative block aspect-3/4 overflow-hidden bg-sand no-underline"
    >
      <Image
        src={collection.cardUrl}
        alt={collection.cardAlt}
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        className={`object-cover transition-[filter] duration-700 ease-out ${IMAGE_TONE[tone]}`.trimEnd()}
      />

      {/* The house banner scrim, base anchor — the caption sits on the bottom
          edge of the card, which is the same shape a collection banner has. */}
      <div aria-hidden="true" className="banner-scrim banner-scrim-base" />

      <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12">
        <p className="eyebrow mb-3">{ordinal}</p>
        {/*
          `dir="auto"` rather than an LTR island: the category collections carry
          an Arabic name and every description is translated, while the house
          ranges (Signature, Noir, Gemstone) fall back to their Latin name —
          which the first strong character resolves correctly either way.
        */}
        <h3
          dir="auto"
          className="mb-5 font-heading text-3xl font-normal text-ground md:text-4xl"
        >
          {collection.name}
        </h3>
        <p
          dir="auto"
          className="mb-8 max-w-md text-xs leading-relaxed text-ground-muted md:text-sm"
        >
          {collection.subdescription}
        </p>
        <span className="font-heading text-[11px] uppercase tracking-[0.2em] text-ground-accent transition-transform duration-300 ease-out group-hover:translate-x-1 rtl:group-hover:-translate-x-1">
          {dict.common.explore} {readingArrow(locale)}
        </span>
      </div>
    </LocaleLink>
  );
}
