"use client";

/**
 * Where the parcel goes.
 *
 * ## The fields are the address book's too
 *
 * Street, landmark, city and country come from `<AddressFields>`, which the
 * profile's address book renders as well, so a customer meets one address form
 * wherever they are asked for one. What is asked, what is not (governorate,
 * postal code) and why, is written there. This step adds what belongs to an
 * order rather than to an address: the saved-address chips, the
 * outside-Egypt notice, the delivery note and the save checkbox.
 *
 * ## Saved addresses
 *
 * A signed-in customer's Egyptian addresses from `/account/addresses` arrive as
 * `savedAddresses`, default first, and the first one has already filled these
 * fields by the time they render. With two or more, a row of chips above the
 * fields lets the customer switch between them. A chip *copies* values into the
 * form and nothing more: editing the fields afterwards changes this order's
 * address, never the saved one.
 *
 * "Save this address to my profile" is offered to a signed-in customer only
 * while the fields do not already match a saved address. Ticked, it asks the
 * server to *add* the address to the book once the order is written. It never
 * overwrites an entry. See `placeCustomerOrder`.
 *
 * A guest gets none of this: no chips, no notice, no checkbox.
 */


import { HOUSE_EMAIL } from "@/src/constants/contact";
import { sameAddress } from "@/src/lib/address-match";
import { SHIPPING_COUNTRY } from "@/src/lib/shipping";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { CheckoutSavedAddress } from "@/src/types/checkout";

import AddressFields from "./AddressFields";
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
   * It decides only whether the field explains itself. The country arrives
   * chosen, with a line underneath saying where that came from — and the
   * visitor can choose another, which is the whole point: detection is often
   * wrong about somebody standing in Cairo behind a VPN, and being wrong must
   * not be final.
   */
  countryDetected: boolean;
  /** False only when the detected country is one the house does not deliver to. */
  shipsHere: boolean;
  /** The customer's Egyptian saved addresses, default first. Empty for a guest. */
  savedAddresses: readonly CheckoutSavedAddress[];
  /** Fill the fields from one saved address. */
  onApplySaved: (address: CheckoutSavedAddress) => void;
  /** Signed in, and the fields do not match a saved address. */
  canSave: boolean;
  saveToProfile: boolean;
  onSaveToProfileChange: (next: boolean) => void;
}

export default function DeliveryStep({
  values,
  onChange,
  errors,
  complete,
  countryDetected,
  shipsHere,
  savedAddresses,
  onApplySaved,
  canSave,
  saveToProfile,
  onSaveToProfileChange,
}: DeliveryStepProps) {
  const dict = useDictionary();
  const copy = dict.checkout.delivery;

  return (
    <CheckoutSection index="02" title={dict.checkout.steps.delivery} complete={complete}>
      {savedAddresses.length > 0 ? (
        <div className="sm:col-span-2">
          {savedAddresses.length > 1 ? (
            <>
              <p
                id="checkout-saved-heading"
                className="mb-3 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent/70"
              >
                {copy.savedHeading}
              </p>

              <div
                role="group"
                aria-labelledby="checkout-saved-heading"
                className="mb-4 flex flex-wrap gap-2"
              >
                {savedAddresses.map((address) => {
                  const active = sameAddress(
                    { ...address, country: SHIPPING_COUNTRY },
                    values,
                  );

                  return (
                    <button
                      key={address.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onApplySaved(address)}
                      className={`min-h-11 max-w-full truncate rounded-none border px-4 py-2 font-heading text-[10px] uppercase tracking-[0.2em] transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ground-accent/50 ${
                        active
                          ? "border-ground-accent text-ground-accent"
                          : "border-ground-border text-ground-muted hover:border-ground-accent/50 hover:text-ground"
                      }`}
                    >
                      {address.label}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          <p className="text-[11px] leading-relaxed text-ground-muted">
            {copy.savedNotice}
          </p>
        </div>
      ) : null}

      <AddressFields
        idPrefix="checkout"
        values={values}
        onChange={onChange}
        errors={errors}
        // Detection pre-fills the country and says so underneath; it never
        // takes the choice away.
        countryHint={countryDetected ? copy.countryDetected : undefined}
        includeOtherCountry
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

      {/*
       * The house checkbox, as on `/sign-up`: a native input painted gold with
       * `accent-color`, so its keyboard behaviour, focus ring and announcement
       * are the platform's own.
       */}
      {canSave ? (
        <label className="flex cursor-pointer items-start gap-3 border border-ground-border px-5 py-4 text-start sm:col-span-2">
          <input
            type="checkbox"
            checked={saveToProfile}
            onChange={(event) => onSaveToProfileChange(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-gold"
          />

          <span>
            <span className="block text-xs leading-relaxed text-ground-muted">
              {copy.saveToProfile}
            </span>
            <span className="mt-1 block text-[11px] leading-relaxed text-ground-muted/70">
              {copy.saveToProfileHint}
            </span>
          </span>
        </label>
      ) : null}
    </CheckoutSection>
  );
}
