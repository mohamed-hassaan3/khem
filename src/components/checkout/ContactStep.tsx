"use client";

/**
 * Who the order is for, and how to reach them.
 *
 * Three fields, all required. The email is required because it is the only way
 * a receipt, a shipping notice, or a delivery confirmation reaches anybody —
 * the page promises all three. The phone is required for a blunter reason: a
 * courier in Cairo calls ahead, and an address with no number is a parcel that
 * comes back.
 *
 * ## Pre-fill is a convenience, never an identity
 *
 * A signed-in visitor's name and email arrive from `getViewer()` on the server
 * and are dropped into the fields, which they may then edit — somebody may well
 * be sending a gift under another name. The server does not read these back as
 * identity: `src/actions/checkout.ts` stamps `clerkUserId` from `await auth()`,
 * so what is typed here decides where the parcel goes and nothing about who the
 * order belongs to.
 */

import { interpolate } from "@/src/lib/i18n/interpolate";
import { useDictionary } from "@/src/providers/i18n-provider";

import { CheckoutField, CheckoutSection } from "./CheckoutField";

export interface ContactStepProps {
  name: string;
  email: string;
  phone: string;
  onChange: (field: "customerName" | "customerEmail" | "customerPhone", value: string) => void;
  errors: Record<string, string | undefined>;
  complete: boolean;
  /** The signed-in address, when there is one — shown, not enforced. */
  sessionEmail: string | null;
}

export default function ContactStep({
  name,
  email,
  phone,
  onChange,
  errors,
  complete,
  sessionEmail,
}: ContactStepProps) {
  const dict = useDictionary();
  const copy = dict.checkout.contact;

  return (
    <CheckoutSection index="01" title={dict.checkout.steps.contact} complete={complete}>
      {/*
       * Spans both columns so the session line sits directly under the section
       * header rather than beside a field, where it would read as that field's
       * hint.
       */}
      <p className="text-[11px] leading-relaxed tracking-wide text-ivory/30 sm:col-span-2">
        {sessionEmail
          ? interpolate(copy.signedInAs, { email: sessionEmail })
          : copy.guestNote}
      </p>

      <CheckoutField
        id="checkout-name"
        label={copy.name}
        placeholder={copy.namePlaceholder}
        value={name}
        onChange={(value) => onChange("customerName", value)}
        error={errors.customerName}
        autoComplete="name"
        required
        wide
      />

      <CheckoutField
        id="checkout-email"
        type="email"
        label={copy.email}
        placeholder={copy.emailPlaceholder}
        hint={copy.emailHint}
        value={email}
        onChange={(value) => onChange("customerEmail", value)}
        error={errors.customerEmail}
        autoComplete="email"
        required
      />

      <CheckoutField
        id="checkout-phone"
        type="tel"
        label={copy.phone}
        placeholder={copy.phonePlaceholder}
        hint={copy.phoneHint}
        value={phone}
        onChange={(value) => onChange("customerPhone", value)}
        error={errors.customerPhone}
        autoComplete="tel"
        required
      />
    </CheckoutSection>
  );
}
