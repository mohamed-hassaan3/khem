/**
 * Money, as the desk reads it.
 *
 * Not `formatPrice()` from `src/lib/format.ts`: that converts into the
 * *visitor's* display currency, which is the last thing a working screen
 * wants. An editor is checking what was stored, and what is stored is Egyptian
 * pounds — so a dashboard that helpfully showed a euro price would be showing
 * a number that is in no column anywhere.
 *
 * The same three lines lived in `admin/products/page.tsx`; the orders,
 * inventory and analytics screens made it a fourth copy, which is one more
 * than a rounding rule should have.
 */

/** `EGP 1,470.00` — piastres rendered as pounds. */
export function egp(priceInCents: number): string {
  return `EGP ${(priceInCents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * `EGP 41,300` — the same amount without the piastres.
 *
 * For headline figures and chart axes, where two decimal places on a five
 * figure total is noise an editor has to read past.
 */
export function egpCompact(priceInCents: number): string {
  return `EGP ${Math.round(priceInCents / 100).toLocaleString("en-US")}`;
}
