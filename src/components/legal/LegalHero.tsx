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
  /*
   * A *utility* banner (§14): compact, informative, and the quietest of the
   * four shapes. A policy page does not need a 60vh photographic masthead, and
   * it certainly did not need one at `brightness-[0.22]` — that was the single
   * darkest surface on the site, on the pages a visitor reaches when they want
   * a plain answer.
   */
  /*
   * A *utility* banner: compact, informative, the quietest of the four shapes.
   * A policy page does not need a photographic masthead half a viewport tall,
   * and it certainly did not need one at `brightness-[0.22]`.
   *
   * The `min-h` is sized to the block it carries — eyebrow, title, rule, lede
   * and a date. It needs no header clearance of its own: the page wrapper
   * reserves `--header-h` for the whole document, so the banner begins below
   * the nav rather than behind it.
   */
  return (
    <section className="ground-ivory relative flex h-[46vh] min-h-95 items-end overflow-hidden">
      <Image
        src={banner.url}
        alt={banner.alt}
        fill
        priority
        quality={80}
        sizes="100vw"
        className="object-cover"
      />

      {/* Bottom fade, so the image resolves into the page body rather than cutting. */}
      <div
        aria-hidden="true"
        className="banner-scrim banner-scrim-base"
      />
      <div aria-hidden="true" className="grain absolute inset-0" />

      <Reveal className="relative z-10 max-w-3xl px-4 pb-10 md:px-20 md:pb-20">
        <p className="eyebrow mb-5">{eyebrow}</p>
        <h1 className="mb-6 font-heading text-4xl font-normal leading-tight text-ground sm:text-5xl md:text-6xl">
          {title}
        </h1>
        <div className="gold-line mb-6" />
        <p className="text-sm leading-loose text-ground-muted">{lede}</p>
        <p className="mt-8 font-body text-[10px] uppercase tracking-[0.25em] text-ground-accent">
          Last updated {formatLegalDate(updatedAt)}
        </p>
      </Reveal>
    </section>
  );
}
