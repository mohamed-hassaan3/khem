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
import CheckoutDisclosure from "./CheckoutDisclosure";
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
  /** Clear the address fields to type a new one (client state only). */
  onNewAddress: () => void;
  /**
   * The delivery line under the address, already formatted by the view:
   * "Complimentary" or the fee. Display only; the server prices delivery.
   */
  deliveryLine: string;
  /** Whether `deliveryLine` is the complimentary case (drawn in gold). */
  deliveryIsFree: boolean;
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
  onNewAddress,
  deliveryLine,
  deliveryIsFree,
  canSave,
  saveToProfile,
  onSaveToProfileChange,
}: DeliveryStepProps) {
  const dict = useDictionary();
  const copy = dict.checkout.delivery;

  return (
    <CheckoutSection index="02" title={dict.checkout.steps.delivery} complete={complete}>
      {/*
        Saved addresses as one-tap cards in a swipe row, then "+ New" to type
        another. Default first, as the service returns them. A card is pressed
        when the fields match it exactly, so editing a line releases it.
      */}
      {savedAddresses.length > 0 ? (
        <div className="sm:col-span-2">
          <p id="checkout-saved-heading" className="sr-only">
            {copy.savedHeading}
          </p>
          <div
            role="group"
            aria-labelledby="checkout-saved-heading"
            className="khem-scroll-track -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
          >
            {savedAddresses.map((address, index) => {
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
                  className={`flex min-h-14 min-w-33 shrink-0 cursor-pointer flex-col items-start justify-center gap-0.5 rounded-lg border px-3 py-2.5 text-start text-xs transition-[border-color,box-shadow,background-color] duration-500 ease-luxury-bezier focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent ${
                    active
                      ? "border-ground-accent bg-stone shadow-[inset_0_0_0_1px_var(--color-gold-deep)]"
                      : "border-ground-border bg-white hover:border-ground-accent/50"
                  }`}
                >
                  <span
                    className={`text-[10px] uppercase tracking-[0.16em] ${
                      active ? "text-ground-accent" : "text-ground-muted"
                    }`}
                  >
                    {index === 0
                      ? `${address.label} · ${copy.savedDefault}`
                      : address.label}
                  </span>
                  <span dir="auto" className="max-w-40 truncate text-ground">
                    {address.city}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={onNewAddress}
              className="flex min-h-14 min-w-24 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-ground-border bg-transparent px-3 text-xs text-ground-accent transition-colors duration-300 hover:border-ground-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent"
            >
              {copy.newAddress}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ground-muted">
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

      {/*
        The note is optional, so it waits behind a row; it opens by itself
        when it already holds text or the server refused it.
      */}
      <CheckoutDisclosure
        title={copy.noteToggle}
        forceOpen={values.note.trim() !== "" || Boolean(errors.note)}
        className="-mt-1 sm:col-span-2"
      >
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
      </CheckoutDisclosure>

      <p className="ground-stone flex items-center justify-between gap-3 rounded-md bg-ground-bg px-3 py-3 text-xs sm:col-span-2">
        <span className="text-ground-muted">{copy.deliveryRow}</span>
        <span className={deliveryIsFree ? "text-ground-accent" : "tabular-nums text-ground"}>
          {deliveryLine}
        </span>
      </p>

      {/*
       * The house checkbox, as on `/sign-up`: a native input painted gold with
       * `accent-color`, so its keyboard behaviour, focus ring and announcement
       * are the platform's own.
       */}
      {canSave ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-ground-border px-4 py-3.5 text-start sm:col-span-2">
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
