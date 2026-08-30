import Image from "next/image";

/**
 * The `/new-arrival` hero — Server Component.
 *
 * Deliberately not `<CategoryHero>`. That one is a category masthead: text
 * pinned to the start edge over a half-lit photograph, sized to get out of the
 * way of the grid beneath it. This page is a showroom with two products in it,
 * so its opening is centred, taller, and closes on a counter that tells the
 * visitor exactly how much there is to see — the job a listing hero does not
 * have to do.
 */

export interface NewArrivalHeroProps {
  eyebrow: string;
  /** First line of the display title — ivory. */
  titleLead: string;
  /** Second line — gold. */
  titleAccent: string;
  description: string;
  /** "Two new compositions" — the counter under the rule. */
  count: string;
  imageUrl: string;
  imageAlt: string;
}

export default function NewArrivalHero({
  eyebrow,
  titleLead,
  titleAccent,
  description,
  count,
  imageUrl,
  imageAlt,
}: NewArrivalHeroProps) {
  return (
    <section className="ground-ivory relative flex h-[78vh] min-h-140 items-center justify-center overflow-hidden bg-sand">
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
        The house banner scrim, centre anchor — the type is centred over the
        frame and has no edge to anchor to, so a radial pool carries it. This
        was two hand-written layers saying roughly the same thing; the variant
        keeps both jobs and holds the same contrast floor as the other anchors.
      */}
      <div aria-hidden="true" className="banner-scrim banner-scrim-center" />

      <div className="relative z-1 w-full px-4 text-center md:px-20">
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow mb-6">{eyebrow}</p>

          <h1 className="font-heading text-4xl font-normal leading-tight text-ground sm:text-6xl md:text-7xl">
            {titleLead}
            <br />
            <span className="text-ground-accent">{titleAccent}</span>
          </h1>

          <div className="gold-line mx-auto my-9 w-24" />

          <p className="mx-auto max-w-xl text-[15px] leading-loose text-ground-muted">
            {description}
          </p>

          <p className="mt-6 md:mt-10 font-heading text-[11px] uppercase tracking-[0.3em] text-ground-accent">
            {count}
          </p>
        </div>
      </div>
    </section>
  );
}
