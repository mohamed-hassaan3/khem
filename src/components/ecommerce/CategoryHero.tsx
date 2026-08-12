import Image from "next/image";

/**
 * The opening hero shared by `/body-care`, `/room-fragrance`, and `/discovery`
 * — Server Component.
 *
 * All three routes open on the same shape: a full-bleed photograph graded down
 * to near-black, a two-line display title whose second line is gold, a rule,
 * and a paragraph. Keeping it in one component is what stops the three pages
 * drifting apart the way the original SPA files had, where the same hero was
 * pasted three times with three different scrim gradients.
 */

export interface CategoryHeroProps {
  eyebrow: string;
  /** First line of the display title — ivory. */
  titleLead: string;
  /** Second line — gold. */
  titleAccent: string;
  description: string;
  /** Optional single line under the description, e.g. the discovery promise. */
  note?: string;
  imageUrl: string;
  imageAlt: string;
}

export default function CategoryHero({
  eyebrow,
  titleLead,
  titleAccent,
  description,
  note,
  imageUrl,
  imageAlt,
}: CategoryHeroProps) {
  return (
    <section className="relative flex h-[60vh] min-h-105 items-center overflow-hidden bg-black">
      <Image
        src={imageUrl}
        alt={imageAlt}
        fill
        priority
        quality={85}
        sizes="100vw"
        className="object-cover brightness-30 saturate-60"
      />

      {/*
       * A logical-direction gradient: `to-e` runs toward the end of the line,
       * so the dark side stays behind the text in Arabic instead of leaving it
       * washed out over the bright half of the photograph.
       */}
      <div className="absolute inset-0 bg-linear-to-e from-background/97 via-background/70 to-background/30" />

      <div className="relative z-1 w-full px-6 md:px-20">
        <div className="mx-auto max-w-350">
          <div className="max-w-2xl">
            <p className="eyebrow mb-5">{eyebrow}</p>

            <h1 className="font-heading text-4xl font-normal leading-tight text-ivory sm:text-6xl md:text-7xl">
              {titleLead}
              <br />
              <span className="text-gold">{titleAccent}</span>
            </h1>

            <div className="gold-line my-7" />

            <p className="max-w-lg text-[15px] leading-loose text-ivory/50">
              {description}
            </p>

            {note ? (
              <p className="mt-9 font-heading text-[11px] tracking-[0.2em] text-gold/60">
                {note}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
