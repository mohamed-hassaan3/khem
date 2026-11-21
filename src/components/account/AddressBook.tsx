"use client";

/**
 * The address book, and the first screen in the house that can write one.
 *
 * ## The list is the server's answer, not an optimistic guess
 *
 * Every action in `src/actions/addresses.ts` replies with the customer's
 * addresses as they now stand, read back through the same query the page
 * rendered from. So this component never patches its own list: it replaces it
 * with what the database says. That matters most for the rule it cannot see —
 * `address_one_default_idx` allows a single default per customer, and deleting
 * the default promotes the oldest survivor — where an optimistic edit would
 * have to reimplement the promotion in the browser and would be wrong the first
 * time the two disagreed.
 *
 * ## The same form as the checkout
 *
 * Street, landmark, city and country are `<AddressFields>`, the block the
 * checkout's delivery step renders, so the fields, their order, their wording,
 * the city list and the country list are the checkout's own. Only the label
 * ("Home", "Office" — what the checkout's chips are called) and the recipient
 * are the address book's, and they are drawn with the same `<CheckoutField>`.
 *
 * Governorate and postal code are not asked, as they are not at checkout. An
 * address that already holds either keeps it: the draft carries both and the
 * form simply does not show them.
 *
 * ## Inline, not a modal
 *
 * The form opens beneath the grid. This page is already a panel inside the
 * portal; a dialog over a panel is a second layer for a six-field form that
 * has nothing to interrupt.
 *
 * ## Removal confirms in place
 *
 * A second click on the same control, which becomes "Confirm removal" and
 * reverts on a blur or on any other action. `window.confirm` would be a system
 * dialog in the middle of a boutique, and a modal would be the layer the form
 * already declined.
 */

import { useId, useState, useTransition } from "react";

import AddressCard from "@/src/components/account/AddressCard";
import AddressFields, {
  type AddressFieldName,
} from "@/src/components/checkout/AddressFields";
import { CheckoutField } from "@/src/components/checkout/CheckoutField";
import type { AddressResult } from "@/src/actions/addresses";
import {
  deleteAddress,
  saveAddress,
  setDefaultAddress,
} from "@/src/actions/addresses";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { SHIPPING_COUNTRY } from "@/src/lib/shipping";
import type { AddressErrorCode, AddressField } from "@/src/schemas/address";
import type { SavedAddress } from "@/src/types/account";

type Copy = Dictionary["account"]["addresses"];

/**
 * The form's state. `state` and `postalCode` are not shown, but are carried so
 * that editing an address that has them does not erase them.
 */
interface Draft {
  id?: string;
  label: string;
  recipient: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

function draftFrom(address: SavedAddress): Draft {
  return {
    id: address.id,
    label: address.label,
    recipient: address.recipient,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    isDefault: address.isDefault,
  };
}

/**
 * A new address starts in Egypt — the house delivers there, and the country is
 * stored as its ISO code exactly as the checkout stores it. One vocabulary for
 * a country across both forms is what lets a saved address fill a checkout.
 */
function emptyDraft(country: string): Draft {
  return {
    label: "",
    recipient: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country,
    isDefault: false,
  };
}

/*
 * `min-h-11 inline-flex`: these were the height of their 10px label, a ~15px
 * tap target for Edit / Delete / Make default on a phone. Now each is a 44px
 * row, and the surrounding spacing is reduced to match.
 */
const GHOST_ACTION =
  "inline-flex min-h-11 cursor-pointer items-center bg-transparent p-0 font-heading text-[10px] uppercase tracking-[0.16em] text-ground-muted underline-offset-4 transition-colors duration-300 ease-luxury-bezier hover:text-ground-accent hover:underline disabled:cursor-default disabled:opacity-40";

export default function AddressBook({
  initial,
  locale,
  dict,
}: {
  initial: readonly SavedAddress[];
  locale: Locale;
  dict: Copy;
}) {
  const copy = dict.form;
  const formId = useId();

  const [addresses, setAddresses] = useState<readonly SavedAddress[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<
    Partial<Record<AddressField, AddressErrorCode>>
  >({});
  const [notice, setNotice] = useState<"saved" | "failed" | "removeFailed" | null>(
    null,
  );
  const [confirming, setConfirming] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /*
   * The country *stored* on the address being edited, not the draft's: a saved
   * address in a country no longer featured (the book offered every country
   * until it did not) stays in the list for as long as the form is open, so it
   * neither shows blank nor disappears when the customer tries another country
   * and changes their mind.
   */
  const storedCountry =
    draft?.id === undefined
      ? undefined
      : addresses.find((address) => address.id === draft.id)?.country;

  /** Every action funnels through here, so the list has one writer. */
  function run(
    call: () => Promise<AddressResult>,
    onSuccess: () => void,
    failure: "failed" | "removeFailed",
  ) {
    if (isPending) return;

    setNotice(null);
    setConfirming(null);

    startTransition(async () => {
      const result = await call();

      if (result.ok) {
        setAddresses(result.addresses);
        setErrors({});
        onSuccess();
        return;
      }

      if (result.error === "validation" && result.fieldErrors) {
        setErrors(result.fieldErrors);
        setNotice("failed");
        return;
      }

      setNotice(failure);
    });
  }

  function submit() {
    if (draft === null) return;

    run(
      () => saveAddress(draft),
      () => {
        setDraft(null);
        setNotice("saved");
      },
      "failed",
    );
  }

  /** A field's error code, as a sentence in the reader's language. */
  function errorText(key: AddressField): string | undefined {
    const code = errors[key];
    return code === undefined ? undefined : copy.errors[code];
  }

  /** One field changed: update the draft and retract that field's error. */
  function change(key: AddressFieldName | "label" | "recipient", value: string) {
    setDraft((current) => (current === null ? current : { ...current, [key]: value }));
    setErrors((current) => {
      if (current[key] === undefined) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  return (
    // One settings group: the saved addresses as rows, then "add" (or the
    // form) as the group's last row.
    <div className="overflow-hidden rounded-lg border border-ground-border bg-stone">
      {addresses.length === 0 ? (
        <p className="px-4 py-4 text-[12px] leading-relaxed text-ground-muted sm:px-5">
          {dict.none}
        </p>
      ) : (
        <div className="divide-y divide-ground-border">
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              locale={locale}
              dict={dict}
              actions={
                <>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setErrors({});
                      setNotice(null);
                      setConfirming(null);
                      setDraft(draftFrom(address));
                    }}
                    className={GHOST_ACTION}
                  >
                    {dict.edit}
                  </button>

                  {address.isDefault ? null : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        run(
                          () => setDefaultAddress({ id: address.id }),
                          () => undefined,
                          "failed",
                        )
                      }
                      className={GHOST_ACTION}
                    >
                      {dict.makeDefault}
                    </button>
                  )}

                  {/*
                    * Two clicks, in place. The first turns this control into
                    * its own confirmation; anything else the customer does
                    * clears it, so an abandoned confirmation cannot linger and
                    * be finished by an unrelated click later.
                    */}
                  <button
                    type="button"
                    disabled={isPending}
                    onBlur={() =>
                      setConfirming((current) =>
                        current === address.id ? null : current,
                      )
                    }
                    onClick={() => {
                      if (confirming !== address.id) {
                        setConfirming(address.id);
                        return;
                      }

                      run(
                        () => deleteAddress({ id: address.id }),
                        () => {
                          // A removed address must not stay open in the form.
                          setDraft((current) =>
                            current?.id === address.id ? null : current,
                          );
                        },
                        "removeFailed",
                      );
                    }}
                    className={`${GHOST_ACTION} ${
                      confirming === address.id
                        ? "text-danger hover:text-danger"
                        : ""
                    }`}
                  >
                    {confirming === address.id ? dict.confirmRemove : dict.remove}
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}

      {draft === null ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setErrors({});
            setNotice(null);
            setDraft(emptyDraft(SHIPPING_COUNTRY));
          }}
          className={`${GHOST_ACTION} w-full border-t border-ground-border px-4 text-ground-accent sm:px-5`}
        >
          {dict.add}
        </button>
      ) : (
        <form
          // The action is the validator, as at checkout: its codes come back
          // as sentences under the fields, in the reader's language, rather
          // than as the browser's own bubbles.
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="acct-details-body border-t border-ground-border px-4 py-5 sm:px-6 sm:py-6"
        >
          <p className="mb-5 font-heading text-[13px] tracking-[0.08em] text-ground-accent">
            {draft.id === undefined ? copy.addHeading : copy.editHeading}
          </p>

          {/* The checkout section's grid, so the spacing matches as well. */}
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 md:gap-x-6 md:gap-y-7">
            <CheckoutField
              id={`${formId}-label`}
              label={copy.label}
              value={draft.label}
              onChange={(value) => change("label", value)}
              error={errorText("label")}
              hint={copy.labelHint}
              required
            />

            <CheckoutField
              id={`${formId}-recipient`}
              label={copy.recipient}
              value={draft.recipient}
              onChange={(value) => change("recipient", value)}
              error={errorText("recipient")}
              autoComplete="name"
              required
            />

            <AddressFields
              idPrefix={formId}
              values={draft}
              onChange={change}
              errors={{
                line1: errorText("line1"),
                line2: errorText("line2"),
                city: errorText("city"),
                country: errorText("country"),
              }}
              includeOtherCountry={false}
              keepCountry={storedCountry}
            />

            {/* The checkout's checkbox row, so the two forms end alike. */}
            <label className="flex cursor-pointer items-start gap-3 border border-ground-border px-4 py-3 text-start sm:col-span-2 sm:px-5 sm:py-4">
              <input
                type="checkbox"
                checked={draft.isDefault}
                onChange={(event) =>
                  setDraft({ ...draft, isDefault: event.target.checked })
                }
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-gold"
              />

              <span className="block text-xs leading-relaxed text-ground-muted">
                {copy.makeDefault}
              </span>
            </label>
          </div>

          {/* Phone: the save button is full-width at the 44px floor, Cancel
              beneath it; from `sm` the compact pair sits on one line. */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-1 sm:mt-8">
            <button
              type="submit"
              disabled={isPending}
              className="btn btn-primary btn-sm max-sm:min-h-11 max-sm:w-full"
            >
              {isPending ? copy.saving : copy.save}
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setDraft(null);
                setErrors({});
                setNotice(null);
              }}
              className={GHOST_ACTION}
            >
              {copy.cancel}
            </button>
          </div>
        </form>
      )}

      {/* Always mounted, so the outcome is announced rather than a region
          appearing at the moment it fills. */}
      <p
        aria-live="polite"
        className={`px-4 text-[11px] sm:px-5 [&:not(:empty)]:border-t [&:not(:empty)]:border-ground-border [&:not(:empty)]:py-3 ${
          notice === "saved" ? "text-ground-accent" : "text-danger"
        }`}
      >
        {notice === "saved" ? copy.saved : null}
        {notice === "failed" ? copy.failed : null}
        {notice === "removeFailed" ? copy.removeFailed : null}
      </p>
    </div>
  );
}
