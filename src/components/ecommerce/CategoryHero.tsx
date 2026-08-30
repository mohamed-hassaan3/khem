import Image from "next/image";

/**
 * The opening hero shared by the four category collections under
 * `/collections/[slug]` — Server Component.
 *
 * All of them open on the same shape: a full-bleed photograph graded down
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
  /*
   * The category banner, as an *editorial* banner (§14).
   *
   * Charcoal type over the photograph's own light, with an ivory gradient
   * holding the reading column. It was ivory type over `brightness-30`, which
   * is the dark banner §14 asks to stop repeating — and this component is
   * mounted by every category page, so it was repeating it more than any other
   * single element on the site.
   */
  return (
    <section className="ground-ivory relative flex h-[60vh] min-h-105 items-center overflow-hidden bg-sand">
      <Image
        src={imageUrl}
        alt={imageAlt}
        fill
        priority
        quality={85}
        sizes="100vw"
        className="object-cover"
      />

      {/*
       * The house banner scrim, column anchor — see `globals.css`.
       *
       * This component is why the primitive exists. It carried a *horizontal
       * gradient only*, which guarantees nothing: on `/collections/body-care`
       * it had faded out exactly where the eyebrow and the lede sit, leaving
       * charcoal type on a dark vase. The column variant keeps that
       * composition and adds the floor underneath it.
       *
       * It also mirrors with the document, so the Arabic reading column gets
       * the opaque side rather than the busy half of the frame.
       */}
      <div aria-hidden="true" className="banner-scrim banner-scrim-column" />

      <div className="relative z-1 w-full px-4 md:px-20">
        <div className="mx-auto max-w-350">
          <div className="max-w-2xl">
            <p className="eyebrow mb-5">{eyebrow}</p>

            <h1 className="font-heading text-4xl font-normal leading-tight text-ground sm:text-6xl md:text-7xl">
              {titleLead}
              <br />
              <span className="text-ground-accent">{titleAccent}</span>
            </h1>

            <div className="gold-line my-7" />

            <p className="max-w-lg text-[15px] leading-loose text-ground-muted">
              {description}
            </p>

            {note ? (
              <p className="mt-9 font-heading text-[11px] tracking-[0.2em] text-ground-accent">
                {note}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
