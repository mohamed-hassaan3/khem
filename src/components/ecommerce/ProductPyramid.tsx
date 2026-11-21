
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
  /*
   * One bordered card, three rows: tier label in a fixed column, the notes as
   * a line. It was three `p-7` cards stacked on a phone, a screen and a half
   * for a dozen words. Tiers with no notes are skipped rather than printed
   * empty. Stage 2, `prompts/storefront-redesign-stage-2.md` D7.
   */
  const filled = tiers.filter((tier) => tier.notes.length > 0);
  if (filled.length === 0) return null;

  return (
    <section>
      <h2 className="eyebrow mb-3">{heading}</h2>
      <dl className="rounded-md border border-ground-border px-3.5 py-1 sm:px-4">
        {filled.map((tier) => (
          <div
            key={tier.label}
            className="grid grid-cols-[4.5rem_1fr] gap-2.5 border-t border-ground-border py-2.5 first:border-t-0 sm:grid-cols-[5.5rem_1fr]"
          >
            <dt className="pt-0.5 text-[9px] uppercase leading-relaxed tracking-[0.2em] text-ground-accent">
              {tier.label}
            </dt>
            <dd dir="auto" className="text-[13px] leading-relaxed text-ground">
              {tier.notes.join(" · ")}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
