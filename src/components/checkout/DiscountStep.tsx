"use client";

/**
 * Entering a discount code, and being told before paying whether it works.
 *
 * ## What changed, and why the old note is gone
 *
 * This component used to take a string and hand it over unchecked. Its header
 * argued that a live check "would tell a prober which codes exist, one guess at
 * a time" — so the customer learned about a mistyped or lapsed code at the
 * payment button, which is the worst place to learn it.
 *
 * The objection was right and is answered rather than dropped. `previewDiscount`
 * is throttled per client in its own scope, requires a bag that resolves to real
 * products, and reports only on the code the caller typed. See that action's
 * header for the full argument.
 *
 * ## Still nothing is decided here
 *
 * The verdict and the amount come from `resolve_discount()` — the same function,
 * the same rules, the same sentences. This component renders the answer and
 * holds no copy of the logic. And the answer is an **estimate**: `place_order()`
 * resolves the code again under a lock, against the order it writes, and that is
 * what the customer is charged.
 *
 * Which is why the applied state is dropped the moment the bag, the email or the
 * credit selection moves. `CheckoutView` derives that rather than storing it, so
 * a stale saving cannot survive on screen.
 *
 * ## Mutually exclusive with a Discovery Credit
 *
 * The database refuses both on one order. Rather than let a customer fill in
 * both and be told afterwards, this disables itself while a credit is selected
 * and says why.
 */

import { Check } from "lucide-react";

import Price from "@/src/components/ecommerce/Price";
import VoucherPicker, {
  type CheckoutVoucher,
} from "@/src/components/checkout/VoucherPicker";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { DiscountPreview } from "@/src/types/discount";

/** A code the server has priced against the bag as it currently stands. */
export interface AppliedDiscount {
  code: string;
  amountInCents: number;
}

export interface DiscountStepProps {
  code: string;
  onChange: (next: string) => void;
  /** True while a Discovery Credit is selected — the two cannot combine. */
  disabledByCredit: boolean;
  /**
   * Applies `code`, or the override the voucher picker passes.
   *
   * The override is not a convenience: `onChange` has not settled by the time
   * the picker's click handler runs, so applying "the current code" would
   * check whatever was in the field before.
   */
  onApply: (override?: string) => void;
  onRemove: () => void;
  pending: boolean;
  /** Set once the server has priced the code against this exact bag. */
  applied: AppliedDiscount | null;
  /** The last refusal, or null. Already carries its own reason code. */
  refusal: Extract<DiscountPreview, { ok: false }> | null;
  /** True when a code was applied and the order has since moved beneath it. */
  stale: boolean;
  vouchers: readonly CheckoutVoucher[];
  email: string;
  locale: Locale;
}

export default function DiscountStep({
  code,
  onChange,
  disabledByCredit,
  onApply,
  onRemove,
  pending,
  applied,
  refusal,
  stale,
  vouchers,
  email,
  locale,
}: DiscountStepProps) {
  const dict = useDictionary();
  const copy = dict.checkout.discount;

  /*
   * The translated sentence for a named refusal, and the server's English one
   * for a name this build does not know. Never a generic apology while a real
   * reason exists — §5.4 asks for exactly that, and the reason is already
   * written for a customer.
   */
  const refusalText =
    refusal === null
      ? null
      : refusal.reasonCode === "UNKNOWN"
        ? refusal.reason
        : copy.reason[refusal.reasonCode];

  return (
    <section className="mt-12">
      <h2 className="font-heading text-lg font-normal tracking-[0.1em] text-ground">
        {copy.heading}
      </h2>

      {disabledByCredit ? (
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ground-muted">
          {copy.blockedByCredit}
        </p>
      ) : applied ? (
        /* ── Applied ───────────────────────────────────── */
        <div className="mt-5 flex max-w-xl flex-wrap items-center justify-between gap-4 border border-ground-accent/30 bg-gold/6 px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-heading text-[13px] tracking-[0.1em] text-ground-accent">
              <Check size={14} strokeWidth={1.5} aria-hidden="true" />
              <span {...ltrIsland(locale)}>
                {interpolate(copy.appliedCode, { code: applied.code })}
              </span>
            </p>

            {/* The saving, as a figure rather than a claim about the rule. */}
            <p className="mt-1.5 flex flex-wrap items-baseline gap-1.5 text-[12px] text-ground-muted">
              {copy.saved}
              <Price cents={applied.amountInCents} className="text-ground-muted" />
            </p>
          </div>

          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 cursor-pointer bg-transparent p-0 font-heading text-[10px] uppercase tracking-[0.18em] text-ground-muted underline-offset-4 transition-colors duration-300 ease-luxury-bezier hover:text-ground-accent hover:underline"
          >
            {copy.remove}
          </button>
        </div>
      ) : (
        /* ── Entering ──────────────────────────────────── */
        <>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ground-muted">
            {copy.lede}
          </p>

          <div className="mt-5 flex max-w-xl flex-wrap gap-3">
            <label htmlFor="discountCode" className="sr-only">
              {copy.heading}
            </label>
            <input
              id="discountCode"
              name="discountCode"
              value={code}
              placeholder={copy.placeholder}
              autoComplete="off"
              disabled={pending}
              // Uppercased for the eye only; the server uppercases what it
              // stores and compares, so a lowercase entry is equally valid.
              onChange={(event) => onChange(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                // Enter applies the code rather than submitting the order — a
                // half-filled checkout posted by a keystroke in this field is
                // not what anybody meant by pressing it here.
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (!pending && code.trim() !== "") onApply();
              }}
              className="field min-w-0 flex-1 font-heading uppercase tracking-[0.15em] placeholder:tracking-normal disabled:opacity-50"
            />

            <button
              type="button"
              onClick={() => onApply()}
              disabled={pending || code.trim() === ""}
              className="shrink-0 cursor-pointer border border-ground-accent/40 px-6 py-3 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-all duration-500 ease-luxury-bezier hover:border-gold hover:bg-gold/8 disabled:cursor-not-allowed disabled:border-ground-border disabled:text-ground-muted/60"
            >
              {pending ? copy.applying : copy.apply}
            </button>
          </div>

          {/*
           * One live region for both messages, so a screen reader hears the
           * refusal or the stale notice without either being announced twice.
           */}
          <p
            aria-live="polite"
            className={`mt-3 min-h-4 max-w-xl text-[12px] leading-relaxed ${
              refusalText ? "text-danger" : "text-warning"
            }`}
          >
            {refusalText ?? (stale ? copy.stale : null)}
          </p>

          <VoucherPicker
            vouchers={vouchers}
            email={email}
            locale={locale}
            disabled={pending}
            onUse={(next) => {
              onChange(next);
              // Applied through the same path a typed code takes; the picker
              // has no privileged route of its own.
              onApply(next);
            }}
          />
        </>
      )}
    </section>
  );
}
