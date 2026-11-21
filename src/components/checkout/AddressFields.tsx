"use client";

/**
 * The address block: one form, wherever an address is asked for.
 *
 * Street, landmark, city and country, rendered by the checkout's delivery step
 * and by the profile's address book alike. Before this they were two forms
 * that looked related and were not: the profile asked for a governorate and a
 * postal code the checkout does not, took the city as free text where the
 * checkout offers a list, and worded every label its own way. A customer who
 * saved an address in one and met it in the other saw two different houses.
 *
 * So the checkout's version is the one, and it lives here. Both parents render
 * it inside their own grid (it returns direct grid children), wrap it in their
 * own frame — a numbered section at checkout, a panel in the profile — and add
 * what only they need: the delivery note belongs to an order, the label and
 * recipient to the address book.
 *
 * ## What it deliberately does not ask
 *
 * Governorate and postal code. Egyptian addresses frequently carry no postal
 * code, a courier works from the street, the landmark and the city, and every
 * extra field on a form is somewhere a customer stops. A saved address that
 * already holds either keeps it: the parent's state carries values this
 * component simply does not show.
 *
 * ## `line2` is a landmark, not an apartment
 *
 * Cairo addresses are commonly given relative to something — "beside the
 * Carrefour", "behind the mosque" — and a courier reads that line before the
 * street. The label says so rather than "Address line 2", which would invite
 * people to leave it empty.
 *
 * ## "Other city" is derived, not remembered
 *
 * The city control is a list of the cities the house delivers to, plus "Other
 * city", which reveals a text field. Whether that text field shows is worked
 * out from the value on every render:
 *
 *     showOther = the city is filled in but not on the list
 *              || (the customer just chose "Other city" && nothing is typed yet)
 *
 * So a saved "Luxor" opens as "Other city / Luxor" whether it arrived by
 * prefill, by a saved-address chip, or by editing it in the profile, with no
 * effect and no handler in the parent having to remember to set a flag.
 */

import { useMemo, useState } from "react";

import { DELIVERY_CITIES } from "@/src/constants/delivery-cities";
import { countryOptions } from "@/src/lib/shipping";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";

import { CheckoutField, CheckoutSelect } from "./CheckoutField";

/**
 * The dropdown's "Other city" entry. A value the select holds and nothing else
 * ever sees: choosing it empties the city and reveals a text field, so this
 * string cannot reach an order or the address book.
 */
const OTHER_CITY = "__other__";

export type AddressFieldName = "line1" | "line2" | "city" | "country";

export interface AddressFieldsProps {
  /**
   * Prefix for every element id. The checkout passes `"checkout"`, which keeps
   * the ids it has always had (`checkout-line1`, `checkout-city`, …).
   */
  idPrefix: string;
  values: Record<AddressFieldName, string>;
  onChange: (field: AddressFieldName, value: string) => void;
  /** Resolved, translated error text per field. `undefined` when valid. */
  errors: Partial<Record<AddressFieldName, string | undefined>>;
  /** A line under the country, e.g. "Chosen from your location". */
  countryHint?: string;
  /**
   * Offer "Another country" at the end of the list. The checkout does, for a
   * visitor placed outside Egypt; the address book does not, because an
   * address the house cannot deliver to is of no use to anybody.
   */
  includeOtherCountry: boolean;
  /**
   * A country already stored on the address being edited, kept in the list
   * even if it is no longer featured. See `countryOptions`.
   */
  keepCountry?: string;
}

/** True when `city` is filled in but is not one the dropdown offers. */
function isUnlistedCity(country: string, city: string): boolean {
  const list = DELIVERY_CITIES[country];
  return list !== undefined && city !== "" && !list.some((c) => c.value === city);
}

export default function AddressFields({
  idPrefix,
  values,
  onChange,
  errors,
  countryHint,
  includeOtherCountry,
  keepCountry,
}: AddressFieldsProps) {
  const dict = useDictionary();
  const locale = useLocale();
  const copy = dict.checkout.delivery;

  /** Set by choosing "Other city", cleared by choosing a listed one. */
  const [choseOther, setChoseOther] = useState(false);

  const showOther =
    isUnlistedCity(values.country, values.city) ||
    (choseOther && values.city === "");

  /*
   * Egypt, then the featured countries sorted for this language, then — at
   * checkout — "Another country". Built once per locale rather than on every
   * keystroke; the list is the same for the life of the form.
   */
  const countries = useMemo(() => {
    const { pinned, others } = countryOptions(locale, {
      otherLabel: includeOtherCountry ? copy.countryOther : undefined,
      keep: keepCountry,
    });

    return {
      pinned: [{ value: pinned.code, label: pinned.name }],
      group: {
        label: copy.countryGroup,
        options: others.map(({ code, name }) => ({ value: code, label: name })),
      },
    };
  }, [locale, includeOtherCountry, keepCountry, copy.countryOther, copy.countryGroup]);

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
      setChoseOther(true);
      onChange("city", "");
      return;
    }

    setChoseOther(false);
    onChange("city", next);
  }

  /*
   * Changing country empties the city when it is not one that country offers.
   * Otherwise a customer who switches country keeps a city that no longer
   * belongs to it.
   */
  function handleCountryChange(next: string) {
    onChange("country", next);
    setChoseOther(false);

    const offered = DELIVERY_CITIES[next];
    if (values.city !== "" && !offered?.some((c) => c.value === values.city)) {
      onChange("city", "");
    }
  }

  return (
    <>
      <CheckoutField
        id={`${idPrefix}-line1`}
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
        id={`${idPrefix}-line2`}
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
            id={`${idPrefix}-city`}
            label={copy.city}
            value={showOther ? OTHER_CITY : values.city}
            onChange={handleCitySelect}
            options={cities}
            error={showOther ? undefined : errors.city}
            autoComplete="address-level2"
          />

          {showOther ? (
            <CheckoutField
              id={`${idPrefix}-city-other`}
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
          id={`${idPrefix}-city`}
          label={copy.city}
          value={values.city}
          onChange={(value) => onChange("city", value)}
          error={errors.city}
          autoComplete="address-level2"
          required
        />
      )}

      <CheckoutSelect
        id={`${idPrefix}-country`}
        label={copy.country}
        value={values.country}
        onChange={handleCountryChange}
        // Egypt on its own, then everywhere else under one label. See
        // `src/constants/countries.ts` for why the list is short.
        options={countries.pinned}
        group={countries.group}
        error={errors.country}
        hint={countryHint}
        autoComplete="country"
      />
    </>
  );
}
