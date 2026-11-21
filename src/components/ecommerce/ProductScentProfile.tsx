import LocaleLink from "@/src/components/i18n/LocaleLink";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import type { ScentProfileSlug } from "@/src/lib/scent-profiles";

/**
 * The scent profile of a fragrance — Server Component.
 *
 * One line, one or two chips: *this is what it smells of, in the vocabulary a
 * customer asks in.* It answers the question the note pyramid above it does not,
 * because a pyramid names nine materials and a shopper wants one word.
 *
 * Assigned directly to the product through `ScentProfileProduct`.
 *
 * The derivation is the page's rather than this component's so the call site can
 * skip the `<Reveal>` wrapper entirely on a fragrance with no catalogued
 * material: an empty `<Reveal>` still occupies a gap row in the column.
 *
 * Each chip is a link to that profile's page: a visitor who has just learned
 * they like woody fragrances is one click from the rest of them, which is the
 * entire reason the profile pages exist.
 *
 * Renders nothing on an empty list all the same — a heading over an empty row
 * would be worse than silence, whichever side forgot to check.
 */

export interface ProductScentProfileProps {
  /** Product profile assignments in canonical display order. */
  profiles: ScentProfileSlug[];
  locale: Locale;
}

export default async function ProductScentProfile({
  profiles,
  locale,
}: ProductScentProfileProps) {
  if (profiles.length === 0) return null;

  const dict = await getDictionary(locale);

  return (
    <section>
      <h2 className="sr-only">{dict.product.scentProfileHeading}</h2>

      <div className="flex flex-wrap gap-2">
        {profiles.map((profile) => (
          <LocaleLink
            key={profile}
            href={`/collections/${profile}`}
            /*
             * The `<FilterChip>` treatment from `<CollectionGrid>`, in its
             * resting state — the two are the same object seen twice, and a
             * visitor arriving at `/collections/woody` from here should
             * recognise the chip they pressed.
             */
            className="inline-flex min-h-9 items-center rounded-full border border-ground-accent/40 px-3.5 text-[11px] uppercase tracking-[0.12em] text-ground-accent no-underline transition-colors duration-300 ease-out hover:border-ground-accent hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent"
            dir="auto"
          >
            {dict.collections.scentProfiles[profile].name}
          </LocaleLink>
        ))}
      </div>
    </section>
  );
}
