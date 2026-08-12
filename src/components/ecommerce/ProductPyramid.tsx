import type { LtrIsland } from "@/src/lib/i18n/rtl";

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
  /** Set on the Arabic tree; note names stay English. */
  island: LtrIsland;
}

export default function ProductPyramid({
  tiers,
  heading,
  island,
}: ProductPyramidProps) {
  return (
    <section>
      <h2 className="eyebrow mb-7">{heading}</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {tiers.map((tier) => (
          <div key={tier.label} className="border border-border bg-surface p-7">
            <p className="mb-5 font-heading text-[10px] uppercase tracking-[0.2em] text-gold/60">
              {tier.label}
            </p>

            <ul className="flex flex-col gap-2.5" {...island}>
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
