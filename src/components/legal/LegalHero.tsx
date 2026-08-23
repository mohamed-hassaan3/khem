import Image from "next/image";

import Reveal from "@/src/components/animation/Reveal";
import { formatLegalDate } from "@/src/lib/format";
import type { LegalDocument } from "@/src/types/legal";

/**
 * Banner header shared by the four legal routes.
 *
 * Server Component — the only client code in the subtree is `<Reveal />`.
 *
 * Deliberately shorter than the 85vh editorial hero in `app/about/page.tsx`: a
 * policy page should not make the reader scroll past a full screen of
 * atmosphere before reaching the first sentence.
 */

export type LegalHeroProps = Pick<
  LegalDocument,
  "eyebrow" | "title" | "lede" | "updatedAt" | "banner"
>;

export default function LegalHero({
  eyebrow,
  title,
  lede,
  updatedAt,
  banner,
}: LegalHeroProps) {
  return (
    <section className="relative flex h-[60vh] min-h-100 items-end overflow-hidden">
      <Image
        src={banner.url}
        alt={banner.alt}
        fill
        priority
        quality={80}
        sizes="100vw"
        className="object-cover brightness-[0.22] saturate-50"
      />

      {/* Bottom fade, so the image resolves into the page body rather than cutting. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-background via-background/80 to-transparent"
      />
      <div aria-hidden="true" className="grain absolute inset-0" />

      <Reveal className="relative z-10 max-w-3xl px-4 pb-10 md:px-20 md:pb-20">
        <p className="eyebrow mb-5">{eyebrow}</p>
        <h1 className="mb-6 font-heading text-4xl font-normal leading-tight text-ivory sm:text-5xl md:text-6xl">
          {title}
        </h1>
        <div className="gold-line mb-6" />
        <p className="text-sm leading-loose text-ivory/50">{lede}</p>
        <p className="mt-8 font-body text-[10px] uppercase tracking-[0.25em] text-gold/50">
          Last updated {formatLegalDate(updatedAt)}
        </p>
      </Reveal>
    </section>
  );
}
