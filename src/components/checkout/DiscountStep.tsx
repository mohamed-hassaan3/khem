"use client";

/**
 * Entering a discount code.
 *
 * ## Nothing is validated here
 *
 * The field takes a string and hands it over. Whether the code exists, is
 * active, is in date, is within its caps, or applies to anything in the bag is
 * decided by `resolve_discount()` against the order being written — and the
 * refusal comes back written for the customer, so it is shown verbatim beneath
 * the form's heading.
 *
 * A client-side check would be a second implementation of the same rules,
 * guaranteed to drift, and worthless as a boundary: anybody can call the action
 * without this component.
 *
 * ## Why there is no live "check code" round trip
 *
 * It would tell a prober which codes exist, one guess at a time. The code is
 * resolved once, at the moment it is used, against an order that already knows
 * its own contents.
 *
 * ## Mutually exclusive with a Discovery Credit
 *
 * The database refuses both on one order. Rather than let a customer fill in
 * both and be told afterwards, this disables itself while a credit is selected
 * and says why.
 */

import { useDictionary } from "@/src/providers/i18n-provider";

export default function DiscountStep({
  code,
  onChange,
  disabledByCredit,
}: {
  code: string;
  onChange: (next: string) => void;
  /** True while a Discovery Credit is selected — the two cannot combine. */
  disabledByCredit: boolean;
}) {
  const dict = useDictionary();
  const copy = dict.checkout.discount;

  return (
    <section className="mt-12">
      <h2 className="font-heading text-lg font-normal tracking-[0.1em] text-ivory">
        {copy.heading}
      </h2>

      {disabledByCredit ? (
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ivory/45">
          {copy.blockedByCredit}
        </p>
      ) : (
        <>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ivory/45">
            {copy.lede}
          </p>

          <div className="mt-5 max-w-sm">
            <label htmlFor="discountCode" className="sr-only">
              {copy.heading}
            </label>
            <input
              id="discountCode"
              name="discountCode"
              value={code}
              placeholder={copy.placeholder}
              autoComplete="off"
              // Uppercased for the eye only; the server uppercases what it
              // stores and compares, so a lowercase entry is equally valid.
              onChange={(event) => onChange(event.target.value.toUpperCase())}
              className="w-full border border-border bg-ivory/3 px-4 py-3 font-heading text-[13px] uppercase tracking-[0.15em] text-ivory transition-colors duration-300 placeholder:tracking-normal placeholder:text-ivory/25 focus:border-gold/40 focus:outline-none"
            />
          </div>
        </>
      )}
    </section>
  );
}
