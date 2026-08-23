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
    <section className="relative flex h-[78vh] min-h-140 items-center justify-center overflow-hidden bg-black">
      <Image
        src={imageUrl}
        alt={imageAlt}
        fill
        priority
        quality={85}
        sizes="100vw"
        className="object-cover brightness-45 saturate-50"
      />

      {/* Two scrims: a vertical one to seat the section on the page background,
          and a soft radial pool so the centred type never sits on a bright
          patch of the photograph. */}
      <div className="absolute inset-0 bg-linear-to-t from-background via-background/35 to-background/65" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--color-background)_100%)] opacity-60" />

      <div className="relative z-1 w-full px-4 text-center md:px-20">
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow mb-6">{eyebrow}</p>

          <h1 className="font-heading text-4xl font-normal leading-tight text-ivory sm:text-6xl md:text-7xl">
            {titleLead}
            <br />
            <span className="text-gold">{titleAccent}</span>
          </h1>

          <div className="gold-line mx-auto my-9 w-24" />

          <p className="mx-auto max-w-xl text-[15px] leading-loose text-ivory/50">
            {description}
          </p>

          <p className="mt-6 md:mt-10 font-heading text-[11px] uppercase tracking-[0.3em] text-gold/60">
            {count}
          </p>
        </div>
      </div>
    </section>
  );
}
