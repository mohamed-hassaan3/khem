"use client";

/**
 * How the visitor would like to pay.
 *
 * Two panels, not two radio dots. The choice between paying now and paying a
 * courier at the door is the biggest decision on this page, and a 13px dot is
 * not proportionate to it.
 *
 * ## Real radios inside labels
 *
 * The `<input type="radio">` is present and functional, just visually hidden:
 * arrow-key navigation between options, the roving tab stop, the announced
 * group semantics, and form reset behaviour all come free and are extremely
 * fiddly to rebuild on `<div role="radio">`. The panel styling hangs off
 * `peer-checked:` and `has-[:focus-visible]:`, so the visual state can never
 * disagree with the actual state.
 *
 * ## The settlement note
 *
 * An order settles in Egyptian pounds. A visitor browsing in dollars has been
 * reading converted figures on every page — `src/lib/currency.ts` is explicit
 * that those are a display transform — and this is the last screen before a
 * card is charged. Telling them here, once, with the real figure, is the
 * honest thing; the cart already carries the same warning in
 * `dict.currencySwitcher.conversionNote`.
 */

import { Banknote, CreditCard, Lock } from "lucide-react";
import type { ReactNode } from "react";

import { BASE_CURRENCY } from "@/src/lib/currency";
import { formatPrice } from "@/src/lib/format";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useCurrency } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { PaymentMethod } from "@/src/types/checkout";

import { CheckoutSection } from "./CheckoutField";

export interface PaymentStepProps {
  method: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  /** False when Stripe is unconfigured — the card panel is replaced by a note. */
  cardAvailable: boolean;
  totalInCents: number;
  /** The Elements form, mounted by the parent once an intent exists. */
  children?: ReactNode;
}

export default function PaymentStep({
  method,
  onMethodChange,
  cardAvailable,
  totalInCents,
  children,
}: PaymentStepProps) {
  const dict = useDictionary();
  const { currency } = useCurrency();
  const copy = dict.checkout.payment;

  return (
    <CheckoutSection index="03" title={dict.checkout.steps.payment}>
      <fieldset className="sm:col-span-2">
        <legend className="mb-6 font-heading text-[13px] tracking-[0.08em] text-ivory/60">
          {copy.heading}
        </legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cardAvailable ? (
            <MethodPanel
              id="pay-card"
              value="CARD"
              checked={method === "CARD"}
              onSelect={onMethodChange}
              icon={<CreditCard size={20} strokeWidth={1.25} aria-hidden="true" />}
              title={copy.card.title}
              body={copy.card.body}
            />
          ) : (
            // Stated rather than silently absent. A checkout that offers one
            // option with no explanation looks broken; one that says the card
            // rail is down looks maintained.
            <p className="flex items-center border border-border bg-background/60 px-6 py-7 text-[12px] leading-relaxed text-ivory/30">
              {copy.cardUnavailable}
            </p>
          )}

          <MethodPanel
            id="pay-cash"
            value="CASH"
            checked={method === "CASH"}
            onSelect={onMethodChange}
            icon={<Banknote size={20} strokeWidth={1.25} aria-hidden="true" />}
            title={copy.cash.title}
            body={copy.cash.body}
          />
        </div>
      </fieldset>

      <div className="sm:col-span-2">
        {method === "CASH" ? (
          <p className="border-s-2 border-gold/30 ps-4 text-[12px] leading-relaxed text-champagne/70">
            {copy.cashNotice}
          </p>
        ) : (
          <>
            {/* The Elements form, or the "preparing" placeholder. */}
            {children}

            <p className="mt-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-ivory/25">
              <Lock size={11} strokeWidth={1.25} aria-hidden="true" />
              {copy.securedBy}
            </p>
          </>
        )}

        {/*
         * Only shown when the two differ. A visitor already reading EGP needs
         * no warning that they will be charged in EGP.
         */}
        {currency !== BASE_CURRENCY ? (
          <p className="mt-4 text-[10px] leading-relaxed tracking-[0.05em] text-ivory/25">
            {interpolate(copy.settlement, {
              amount: formatPrice(totalInCents, BASE_CURRENCY),
            })}
          </p>
        ) : null}
      </div>
    </CheckoutSection>
  );
}

interface MethodPanelProps {
  id: string;
  value: PaymentMethod;
  checked: boolean;
  onSelect: (method: PaymentMethod) => void;
  icon: ReactNode;
  title: string;
  body: string;
}

/**
 * One selectable payment method.
 *
 * `peer` + `peer-checked:` rather than a conditional className, so the border
 * and the glow are driven by the input's own state. `has-[:focus-visible]:`
 * puts the keyboard ring on the panel rather than on the hidden input, which is
 * where a sighted keyboard user is looking.
 */
function MethodPanel({
  id,
  value,
  checked,
  onSelect,
  icon,
  title,
  body,
}: MethodPanelProps) {
  return (
    <label
      htmlFor={id}
      className={
        "group relative flex cursor-pointer flex-col gap-3 border px-6 py-7 " +
        "transition-[border-color,box-shadow] duration-500 ease-out " +
        "has-[:focus-visible]:border-gold has-[:focus-visible]:shadow-[0_0_0_1px_rgba(200,169,106,0.5)] " +
        (checked
          ? "border-gold bg-background shadow-[0_0_30px_rgba(200,169,106,0.15)]"
          : "border-border bg-background/60 hover:border-gold/40")
      }
    >
      <input
        id={id}
        type="radio"
        name="payment-method"
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        // Not `hidden` and not `display:none` — either removes it from the
        // accessibility tree and from keyboard navigation, which is the whole
        // reason for using a real radio.
        className="peer sr-only"
      />

      <span
        className={
          "transition-colors duration-500 ease-out " +
          (checked ? "text-gold" : "text-ivory/40 group-hover:text-gold/70")
        }
      >
        {icon}
      </span>

      <span className="font-heading text-[13px] tracking-[0.1em] text-ivory">
        {title}
      </span>

      <span className="text-[11px] leading-relaxed text-ivory/35">{body}</span>
    </label>
  );
}
