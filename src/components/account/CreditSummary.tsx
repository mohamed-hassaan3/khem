import Price from "@/src/components/ecommerce/Price";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";

/**
 * What the house owes this customer, in one figure.
 *
 * The figure is the **face value of the credits that can be spent right now**,
 * and the line beneath it is not decoration: a KHEM Credit is consumed whole
 * against one full-size fragrance and forfeits any remainder
 * (`supabase/sql/0026_discovery_credits.sql`, policies 4–7). Printed as a bare
 * total with no terms it would read as a wallet, which is a different
 * instrument and a promise the checkout would refuse to keep.
 *
 * The count is what makes the sum legible — "EGP 900 available · 3 credits"
 * tells a customer they cannot put nine hundred pounds against one bottle.
 */

export interface CreditSummaryProps {
  availableInCents: number;
  availableCount: number;
  dict: Dictionary["account"]["vouchers"]["credit"];
}

export default function CreditSummary({
  availableInCents,
  availableCount,
  dict,
}: CreditSummaryProps) {
  return (
    <div className="border border-ground-accent/20 bg-gold/6 px-6 py-8 sm:px-10 sm:py-10">
      <p className="eyebrow mb-4">{dict.available}</p>

      <p className="mb-2 font-heading text-4xl font-semibold text-ground-accent sm:text-5xl">
        <Price cents={availableInCents} />
      </p>

      <p className="mb-5 font-heading text-[12px] tracking-[0.08em] text-ground-muted">
        {availableCount === 1
          ? dict.countOne
          : interpolate(dict.count, { count: String(availableCount) })}
      </p>

      <p className="max-w-prose text-[12px] leading-loose text-ground-muted">
        {dict.terms}
      </p>
    </div>
  );
}
