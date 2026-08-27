"use client";

/**
 * The signed-in customer's own vouchers, offered rather than remembered.
 *
 * §5.5 of the plan: "this is preferred over requiring customers to remember
 * voucher codes." A guest never sees it, because a grant belongs to an account —
 * the checkout page simply passes an empty list and this renders nothing.
 *
 * ## Only what a customer needs to choose
 *
 * Code, benefit, minimum, expiry. No grant id, no discount id, no scope
 * internals. Choosing one fills the field and applies it through exactly the
 * same path a typed code takes — there is no privileged "apply my own voucher"
 * route, so nothing here can be replayed into a discount somebody was not
 * granted.
 *
 * ## The address warning
 *
 * A grant is addressed to an email, and both the gate in `resolve_discount()`
 * and the consumption in `place_order()` match on the *order's* address. So a
 * customer signed in as one address who types another at checkout will be
 * refused — truthfully, but at the worst possible moment. When the two differ,
 * this says so before the click rather than after it.
 */

import Price from "@/src/components/ecommerce/Price";
import { formatAccountDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useDictionary } from "@/src/providers/i18n-provider";

/** One voucher, reduced to what the checkout may show and act on. */
export interface CheckoutVoucher {
  code: string;
  kind: "PERCENTAGE" | "FIXED";
  value: number;
  minimumOrderInCents: number;
  expiresAt: string | null;
  /** The address the grant was issued to, for the warning above. */
  grantedTo: string | null;
}

export default function VoucherPicker({
  vouchers,
  email,
  locale,
  disabled,
  onUse,
}: {
  vouchers: readonly CheckoutVoucher[];
  /** The address currently in the form — what the order will actually carry. */
  email: string;
  locale: Locale;
  disabled: boolean;
  onUse: (code: string) => void;
}) {
  const dict = useDictionary();
  const copy = dict.checkout.discount;

  if (vouchers.length === 0) return null;

  const typed = email.trim().toLowerCase();

  return (
    <details className="mt-5 max-w-xl">
      <summary className="cursor-pointer list-none font-heading text-[11px] tracking-[0.14em] text-gold/70 underline-offset-4 transition-colors duration-300 ease-luxury-bezier hover:text-gold hover:underline">
        {copy.vouchers.show}
      </summary>

      <ul className="mt-4 flex flex-col gap-3">
        {vouchers.map((voucher) => {
          const mismatched =
            voucher.grantedTo !== null &&
            typed.length > 0 &&
            voucher.grantedTo !== typed;

          return (
            <li
              key={voucher.code}
              className="flex flex-wrap items-center justify-between gap-4 border border-border px-5 py-4"
            >
              <div className="min-w-0">
                <p
                  {...ltrIsland(locale)}
                  className="font-heading text-[13px] tracking-[0.16em] text-gold"
                >
                  {voucher.code}
                </p>

                <p className="mt-1 flex flex-wrap items-baseline gap-1.5 text-[12px] text-ivory/60">
                  {voucher.kind === "PERCENTAGE" ? (
                    interpolate(dict.account.vouchers.list.percentOff, {
                      value: String(voucher.value),
                    })
                  ) : (
                    <>
                      <Price cents={voucher.value} />
                      <span>{dict.account.vouchers.list.off}</span>
                    </>
                  )}
                </p>

                <div className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-ivory/30">
                  {voucher.minimumOrderInCents > 0 ? (
                    <span className="flex items-baseline gap-1.5">
                      {copy.vouchers.minimum}
                      <Price cents={voucher.minimumOrderInCents} />
                    </span>
                  ) : null}

                  {voucher.expiresAt ? (
                    <span>
                      {interpolate(copy.vouchers.expires, {
                        date: formatAccountDate(voucher.expiresAt, locale),
                      })}
                    </span>
                  ) : null}
                </div>

                {mismatched ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-warning" dir="auto">
                    {interpolate(copy.vouchers.mismatch, {
                      email: voucher.grantedTo ?? "",
                    })}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                disabled={disabled}
                onClick={() => onUse(voucher.code)}
                className="shrink-0 cursor-pointer border border-gold/40 px-4 py-2.5 font-heading text-[10px] uppercase tracking-[0.18em] text-gold transition-all duration-500 ease-luxury-bezier hover:border-gold hover:bg-gold/8 disabled:cursor-not-allowed disabled:border-border disabled:text-ivory/20"
              >
                {copy.vouchers.use}
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
