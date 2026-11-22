import Image from "next/image";

import Reveal from "@/src/components/animation/Reveal";
import { formatLegalDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
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
> & {
  locale: Locale;
  /** `dict.legal.document.lastUpdated` — a template carrying `{date}`. */
  lastUpdatedLabel: string;
};

export default function LegalHero({
  eyebrow,
  title,
  lede,
  updatedAt,
  banner,
  locale,
  lastUpdatedLabel,
}: LegalHeroProps) {
  /*
   * A *utility* banner: compact, informative, the quietest of the four shapes.
   *
   * The photograph is a band and the type sits beneath it, at every width.
   * The type used to sit over the photograph's lower edge, and whether it
   * could be read depended on the picture: the privacy banner is a dark seal,
   * and "Privacy Policy" in charcoal over it could not be read on any screen.
   * The banners are chosen per document in the dashboard, so legibility cannot
   * be left to the picture.
   *
   * No header clearance: the page wrapper reserves `--header-h`.
   */
  return (
    <section className="ground-ivory relative overflow-hidden">
      <div className="relative aspect-2/1 w-full overflow-hidden sm:aspect-auto sm:h-56 md:h-64 lg:h-72">
        <Image
          src={banner.url}
          alt={banner.alt}
          fill
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          className="object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-ground-bg to-transparent md:h-20"
        />
      </div>

      <Reveal className="relative z-10 mx-auto max-w-350 px-4 pb-2 pt-6 md:px-20 md:pt-12">
        <div className="max-w-3xl">
          <p className="eyebrow mb-4 md:mb-5">{eyebrow}</p>
          <h1 className="mb-5 font-heading text-3xl font-normal leading-tight text-ground sm:text-5xl md:mb-6 md:text-6xl">
            {title}
          </h1>
          <div className="gold-line mb-5 md:mb-6" />
          <p className="text-sm leading-loose text-ground-muted">{lede}</p>
          <p className="mt-6 font-body text-[10px] uppercase tracking-[0.25em] text-ground-accent md:mt-8">
            {interpolate(lastUpdatedLabel, {
              date: formatLegalDate(updatedAt, locale),
            })}
          </p>
        </div>
      </Reveal>
    </section>
  );
}
