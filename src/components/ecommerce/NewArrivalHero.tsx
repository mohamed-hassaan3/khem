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
    /*
     * Centred type, on the floor.
     *
     * The alignment is the page's own — a showroom opening has no reading
     * column to hang off, and centring it is deliberate — but the *vertical*
     * placement now follows `<CollectionView>` like every other banner: the
     * photograph owns the top of the frame, the ivory floor comes up under the
     * words. Centred in the middle of the picture is what forced the radial
     * pool that was washing the release photography out.
     */
    <section className="ground-ivory relative flex h-[78vh] min-h-165 items-end justify-center overflow-hidden bg-sand">
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
        The house banner scrim — the floor, as on every page banner, reaching
        far enough to clear a centred block that runs eyebrow → title → rule →
        description → count (~63% of the frame on a phone, ~73% on a desktop) —
        and reaching a little further than the category mastheads because the
        release photography is dark marble, where the gold eyebrow at the top of
        the block needs more floor under it than a pale still life does.
      */}
      <div
        aria-hidden="true"
        className="banner-scrim banner-scrim-base [--scrim-mid:58%] [--scrim-end:100%] md:[--scrim-mid:52%] md:[--scrim-end:96%]"
      />

      <div className="relative z-1 w-full px-4 pb-14 text-center md:px-20 md:pb-18">
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
