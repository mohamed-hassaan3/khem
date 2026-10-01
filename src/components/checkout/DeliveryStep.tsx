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

import { useMemo, useState } from "react";

import { HOUSE_EMAIL } from "@/src/constants/contact";
import { DELIVERY_CITIES } from "@/src/constants/delivery-cities";
import { countryOptions } from "@/src/lib/shipping";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";

import { CheckoutField, CheckoutSection, CheckoutSelect } from "./CheckoutField";

/**
 * The dropdown's "Other city" entry. A value the select holds and nothing else
 * ever sees: choosing it empties the city and reveals a text field, so this
 * string cannot reach the order.
 */
const OTHER_CITY = "__other__";

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
   * It decides only whether the field explains itself. The country arrives
   * chosen, with a line underneath saying where that came from — and the
   * visitor can choose another, which is the whole point: detection is often
   * wrong about somebody standing in Cairo behind a VPN, and being wrong must
   * not be final.
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
  const locale = useLocale();
  const copy = dict.checkout.delivery;

  // True while the visitor has chosen "Other city" and is typing their own.
  const [otherCity, setOtherCity] = useState(false);

  /*
   * Two hundred and fifty names, sorted for this language. Built once per
   * locale rather than on every keystroke in the address fields above — the
   * list is the same for the life of the form.
   */
  const countries = useMemo(
    () =>
      countryOptions(locale).map(({ code, name }) => ({
        value: code,
        label: name,
      })),
    [locale],
  );

  /*
   * The cities on offer for the chosen country, or `null` when the house has
   * not listed any, in which case the field stays free text.
   */
  const cities = useMemo(() => {
    const list = DELIVERY_CITIES[values.country];
    if (!list) return null;

    return [
      { value: "", label: copy.cityPlaceholder },
      ...list.map((city) => ({
        value: city.value,
        label: locale === "ar" ? city.ar : city.value,
      })),
      // For a city the house has not listed. Delivery to it is not promised
      // here: the order is still the house's to accept or refuse.
      { value: OTHER_CITY, label: copy.cityOther },
    ];
  }, [values.country, locale, copy.cityPlaceholder, copy.cityOther]);

  function handleCitySelect(next: string) {
    if (next === OTHER_CITY) {
      setOtherCity(true);
      onChange("city", "");
      return;
    }

    setOtherCity(false);
    onChange("city", next);
  }

  /*
   * Changing country empties the city when it is not one that country offers.
   * Otherwise a visitor who switches country keeps a city that no longer
   * belongs to it, and the dropdown would show a blank for a value it does not
   * hold.
   */
  function handleCountryChange(next: string) {
    onChange("country", next);
    setOtherCity(false);

    const offered = DELIVERY_CITIES[next];
    if (values.city !== "" && !offered?.some((c) => c.value === values.city)) {
      onChange("city", "");
    }
  }

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

      {cities ? (
        <>
          <CheckoutSelect
            id="checkout-city"
            label={copy.city}
            value={otherCity ? OTHER_CITY : values.city}
            onChange={handleCitySelect}
            options={cities}
            error={otherCity ? undefined : errors.city}
            autoComplete="address-level2"
          />

          {otherCity ? (
            <CheckoutField
              id="checkout-city-other"
              label={copy.cityOtherLabel}
              placeholder={copy.cityOtherPlaceholder}
              value={values.city}
              onChange={(value) => onChange("city", value)}
              error={errors.city}
              required
            />
          ) : null}
        </>
      ) : (
        <CheckoutField
          id="checkout-city"
          label={copy.city}
          value={values.city}
          onChange={(value) => onChange("city", value)}
          error={errors.city}
          autoComplete="address-level2"
          required
        />
      )}

     {/*  <CheckoutField
        id="checkout-state"
        label={copy.state}
        value={values.state}
        onChange={(value) => onChange("state", value)}
        error={errors.state}
        autoComplete="address-level1"
        required
      /> */}

{/*       <CheckoutField
        id="checkout-postal"
        label={copy.postalCode}
        placeholder={copy.postalCodePlaceholder}
        value={values.postalCode}
        onChange={(value) => onChange("postalCode", value)}
        error={errors.postalCode}
        autoComplete="postal-code"
      /> */}

      <CheckoutSelect
        id="checkout-country"
        label={copy.country}
        value={values.country}
        onChange={handleCountryChange}
        options={countries}
        error={errors.country}
        hint={countryDetected ? copy.countryDetected : undefined}
        autoComplete="country"
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
          className="border border-ground-accent/30 bg-gold/5 px-5 py-4 sm:col-span-2"
        >
          <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-ground-accent">
            {copy.outsideEgyptTitle}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-ground-muted">
            {copy.outsideEgyptBody}
          </p>
          <a
            href={`mailto:${HOUSE_EMAIL}`}
            className="mt-3 inline-block text-[12px] tracking-wide text-ground-accent underline-offset-4 hover:underline"
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
