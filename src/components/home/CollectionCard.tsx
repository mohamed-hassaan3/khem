import Image from "next/image";
import Link from "next/link";

import type { Collection } from "@/src/types/catalog";

/** Collection card — Server Component. Used by the two-up collections grid. */

export interface CollectionCardProps {
  collection: Collection;
  /** Roman ordinal shown above the title, e.g. "Collection I". */
  ordinal: string;
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

export default function CollectionCard({
  collection,
  ordinal,
  tone = "standard",
}: CollectionCardProps) {
  return (
    <Link
      href={`/collections/${collection.slug}`}
      className="img-zoom group relative block aspect-3/4 overflow-hidden bg-surface no-underline"
    >
      <Image
        src={collection.bannerUrl}
        alt={collection.bannerAlt}
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        className={`object-cover transition-[filter] duration-700 ease-out ${IMAGE_TONE[tone]}`}
      />

      <div
        className={`absolute inset-0 flex flex-col justify-end bg-linear-to-t ${OVERLAY_TONE[tone]} via-transparent to-transparent p-8 md:p-12`}
      >
        <p className="eyebrow mb-3">{ordinal}</p>
        <h3 className="mb-5 font-heading text-3xl font-normal text-ivory md:text-4xl">
          {collection.name}
        </h3>
        <p className="mb-8 max-w-md text-xs leading-relaxed text-ivory/50 md:text-sm">
          {collection.description}
        </p>
        <span className="font-heading text-[11px] uppercase tracking-[0.2em] text-gold transition-transform duration-300 ease-out group-hover:translate-x-1">
          Explore →
        </span>
      </div>
    </Link>
  );
}
