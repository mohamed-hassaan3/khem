
/**
 * The fragrance pyramid — Server Component.
 *
 * Takes prepared tiers rather than a `Product` so the dictionary lookup stays
 * in the page and this component is purely presentational: three columns, three
 * notes each, top → heart → base.
 */

export interface NoteTier {
  label: string;
  notes: string[];
}

export interface ProductPyramidProps {
  tiers: NoteTier[];
  heading: string;
}

export default function ProductPyramid({
  tiers,
  heading,
}: ProductPyramidProps) {
  return (
    <section>
      <h2 className="eyebrow mb-7">{heading}</h2>

      <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-3">
        {tiers.map((tier) => (
          <div key={tier.label} className="border border-border bg-surface p-7">
            <p className="mb-5 font-heading text-[10px] uppercase tracking-[0.2em] text-gold/60">
              {tier.label}
            </p>

            {/* Note names are perfumery vocabulary and are translated. */}
            <ul className="flex flex-col gap-2.5" dir="auto">
              {tier.notes.map((note) => (
                <li
                  key={note}
                  className="flex items-center gap-2.5 text-xs text-ivory/70"
                >
                  <span
                    aria-hidden="true"
                    className="size-1 shrink-0 rounded-full bg-gold"
                  />
                  {note}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
