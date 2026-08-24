"use client";

/**
 * Where the parcel goes.
 *
 * ## Postal code is optional, deliberately
 *
 * Egyptian addresses frequently carry no postal code, and a great many people
 * who have one do not know it. Demanding it is how a domestic checkout loses a
 * domestic sale. `src/schemas/checkout.ts` agrees — it is the only address
 * field with no minimum length.
 *
 * "Governorate" rather than "State" or "Province": that is what the field is
 * called in Egypt, and the house is Egyptian. The Arabic dictionary says
 * "المحافظة" for the same reason.
 *
 * ## `line2` is a landmark, not an apartment
 *
 * Cairo addresses are commonly given relative to something — "beside the
 * Carrefour", "behind the mosque" — and a courier reads that line before they
 * read the street. The label says so instead of saying "Address line 2", which
 * would invite people to leave it empty.
 *
 * ## No saved-address picker yet
 *
 * `/account/addresses` is still empty: there is no `"Address"` table, and
 * `getAddressesForUser` honestly returns `[]`. When it lands, it becomes a row
 * of chips above these fields that fill them in — this component gains a prop
 * and nothing else changes.
 */

import { HOUSE_EMAIL } from "@/src/constants/contact";
import { useDictionary } from "@/src/providers/i18n-provider";

import { CheckoutField, CheckoutSection } from "./CheckoutField";

export type DeliveryField =
  | "line1"
  | "line2"
  | "city"
  | "state"
  | "postalCode"
  | "country"
  | "note";

export interface DeliveryStepProps {
  values: Record<DeliveryField, string>;
  onChange: (field: DeliveryField, value: string) => void;
  errors: Record<string, string | undefined>;
  complete: boolean;
  /**
   * True once the edge has told us where the request came from.
   *
   * It only decides whether the field explains itself — the value arrives
   * pre-filled, with a line underneath saying where it came from. The field
   * stays **editable** either way: detection is a convenience, and a visitor
   * whose IP is routed through the wrong country (a VPN, a mobile carrier
   * homed abroad) must still be able to write their own address.
   */
  countryDetected: boolean;
  /** False only when the detected country is one the house does not deliver to. */
  shipsHere: boolean;
}

export default function DeliveryStep({
  values,
  onChange,
  errors,
  complete,
  countryDetected,
  shipsHere,
}: DeliveryStepProps) {
  const dict = useDictionary();
  const copy = dict.checkout.delivery;

  return (
    <CheckoutSection index="02" title={dict.checkout.steps.delivery} complete={complete}>
      <CheckoutField
        id="checkout-line1"
        label={copy.line1}
        placeholder={copy.line1Placeholder}
        value={values.line1}
        onChange={(value) => onChange("line1", value)}
        error={errors.line1}
        autoComplete="address-line1"
        required
        wide
      />

      <CheckoutField
        id="checkout-line2"
        label={copy.line2}
        placeholder={copy.line2Placeholder}
        value={values.line2}
        onChange={(value) => onChange("line2", value)}
        error={errors.line2}
        autoComplete="address-line2"
        wide
      />

      <CheckoutField
        id="checkout-city"
        label={copy.city}
        value={values.city}
        onChange={(value) => onChange("city", value)}
        error={errors.city}
        autoComplete="address-level2"
        required
      />

      <CheckoutField
        id="checkout-state"
        label={copy.state}
        value={values.state}
        onChange={(value) => onChange("state", value)}
        error={errors.state}
        autoComplete="address-level1"
        required
      />

      <CheckoutField
        id="checkout-postal"
        label={copy.postalCode}
        placeholder={copy.postalCodePlaceholder}
        value={values.postalCode}
        onChange={(value) => onChange("postalCode", value)}
        error={errors.postalCode}
        autoComplete="postal-code"
      />

      <CheckoutField
        id="checkout-country"
        label={copy.country}
        value={values.country}
        onChange={(value) => onChange("country", value)}
        error={errors.country}
        hint={countryDetected ? copy.countryDetected : undefined}
        autoComplete="country-name"
        required
      />

      {/*
       * Shown instead of a field error, and deliberately: nothing the visitor
       * typed is wrong. It is a fact about where they are, so it reads as an
       * apology with a way to reach a person, not as a validation failure.
       *
       * `role="note"` rather than `alert`: it is present from first paint
       * rather than announced in response to an action.
       */}
      {!shipsHere ? (
        <div
          role="note"
          className="border border-gold/30 bg-gold/5 px-5 py-4 sm:col-span-2"
        >
          <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-gold">
            {copy.outsideEgyptTitle}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-ivory/60">
            {copy.outsideEgyptBody}
          </p>
          <a
            href={`mailto:${HOUSE_EMAIL}`}
            className="mt-3 inline-block text-[12px] tracking-wide text-gold underline-offset-4 hover:underline"
          >
            {HOUSE_EMAIL}
          </a>
        </div>
      ) : null}

      <CheckoutField
        id="checkout-note"
        label={copy.note}
        placeholder={copy.notePlaceholder}
        value={values.note}
        onChange={(value) => onChange("note", value)}
        error={errors.note}
        multiline
        wide
      />
    </CheckoutSection>
  );
}
