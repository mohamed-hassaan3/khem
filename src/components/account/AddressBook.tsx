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
 * ## Inline, not a modal
 *
 * The form opens beneath the grid. This page is already a panel inside the
 * portal; a dialog over a panel is a second layer for a nine-field form that
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
import type { AddressResult } from "@/src/actions/addresses";
import {
  deleteAddress,
  saveAddress,
  setDefaultAddress,
} from "@/src/actions/addresses";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { countryOptions, SHIPPING_COUNTRY } from "@/src/lib/shipping";
import type { AddressErrorCode, AddressField } from "@/src/schemas/address";
import type { SavedAddress } from "@/src/types/account";

type Copy = Dictionary["account"]["addresses"];

/** The form's fields, in the order they are asked for. */
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

const FIELD_CLASS = "field field-underline hover:border-ground-accent/40";

const GHOST_ACTION =
  "cursor-pointer bg-transparent p-0 font-heading text-[10px] uppercase tracking-[0.16em] text-ground-muted underline-offset-4 transition-colors duration-300 ease-luxury-bezier hover:text-ground-accent hover:underline disabled:cursor-default disabled:opacity-40";

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

  // The country list the checkout offers, in the reader's language, so the two
  // forms cannot come to different conclusions about where the house delivers.
  const countries = countryOptions(locale);

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

  function field(
    key: AddressField,
    options: {
      label: string;
      placeholder?: string;
      hint?: string;
      wide?: boolean;
      autoComplete?: string;
    },
  ) {
    if (draft === null) return null;

    const id = `${formId}-${key}`;
    const errorCode = errors[key];
    const describedBy = errorCode
      ? `${id}-error`
      : options.hint
        ? `${id}-hint`
        : undefined;

    return (
      <div className={options.wide ? "sm:col-span-2" : undefined}>
        <label
          htmlFor={id}
          className="mb-2 block font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent/70"
        >
          {options.label}
        </label>

        <input
          id={id}
          type="text"
          value={draft[key]}
          onChange={(event) =>
            setDraft({ ...draft, [key]: event.target.value })
          }
          placeholder={options.placeholder}
          autoComplete={options.autoComplete}
          aria-invalid={errorCode ? true : undefined}
          aria-describedby={describedBy}
          className={FIELD_CLASS}
        />

        {errorCode ? (
          <p
            id={`${id}-error`}
            className="mt-2 text-[11px] tracking-wide text-danger"
          >
            {copy.errors[errorCode]}
          </p>
        ) : options.hint ? (
          <p
            id={`${id}-hint`}
            className="mt-2 text-[11px] leading-relaxed text-ground-muted/70"
          >
            {options.hint}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {addresses.length === 0 ? (
        <p className="mb-6 text-[12px] leading-loose text-ground-muted">
          {dict.none}
        </p>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-0.5 lg:grid-cols-2">
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
          className={GHOST_ACTION}
        >
          {dict.add}
        </button>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="border border-ground-border bg-stone px-6 py-7 sm:px-8 sm:py-8"
        >
          <p className="mb-7 font-heading text-[13px] tracking-[0.08em] text-ground-accent">
            {draft.id === undefined ? copy.addHeading : copy.editHeading}
          </p>

          <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 md:gap-x-6 md:gap-y-7">
            {field("label", { label: copy.label, hint: copy.labelHint })}
            {field("recipient", { label: copy.recipient, autoComplete: "name" })}
            {field("line1", {
              label: copy.line1,
              wide: true,
              autoComplete: "address-line1",
            })}
            {field("line2", {
              label: copy.line2,
              placeholder: copy.line2Placeholder,
              wide: true,
              autoComplete: "address-line2",
            })}
            {field("city", { label: copy.city, autoComplete: "address-level2" })}
            {field("state", { label: copy.state, autoComplete: "address-level1" })}
            {field("postalCode", {
              label: copy.postalCode,
              placeholder: copy.postalCodePlaceholder,
              autoComplete: "postal-code",
            })}

            {/*
              * A native select, for the reason `<CheckoutSelect>` gives: the
              * platform already knows how to render two hundred options on a
              * phone, and none of that behaviour has to be re-earned.
              */}
            <div>
              <label
                htmlFor={`${formId}-country`}
                className="mb-2 block font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent/70"
              >
                {copy.country}
              </label>

              <select
                id={`${formId}-country`}
                value={draft.country}
                onChange={(event) =>
                  setDraft({ ...draft, country: event.target.value })
                }
                autoComplete="country-name"
                aria-invalid={errors.country ? true : undefined}
                className={`${FIELD_CLASS} cursor-pointer appearance-none`}
              >
                {countries.map((option) => (
                  <option
                    key={option.code}
                    value={option.code}
                    className="bg-ivory text-ink"
                  >
                    {option.name}
                  </option>
                ))}
              </select>

              {errors.country ? (
                <p className="mt-2 text-[11px] tracking-wide text-danger">
                  {copy.errors[errors.country]}
                </p>
              ) : null}
            </div>
          </div>

          <label className="mt-7 flex cursor-pointer items-center gap-3 text-[12px] text-ground-muted">
            <input
              type="checkbox"
              checked={draft.isDefault}
              onChange={(event) =>
                setDraft({ ...draft, isDefault: event.target.checked })
              }
              className="size-3.5 accent-gold"
            />
            {copy.makeDefault}
          </label>

          <div className="mt-8 flex flex-wrap items-center gap-6">
            <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
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
        className={`mt-4 min-h-4 text-[11px] ${
          notice === "saved" ? "text-ground-accent/70" : "text-danger"
        }`}
      >
        {notice === "saved" ? copy.saved : null}
        {notice === "failed" ? copy.failed : null}
        {notice === "removeFailed" ? copy.removeFailed : null}
      </p>
    </div>
  );
}
