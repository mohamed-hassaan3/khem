import type { ReactNode } from "react";

import type { Locale } from "@/src/lib/i18n/config";
import { countryLabel } from "@/src/lib/shipping";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import type { SavedAddress } from "@/src/types/account";

/**
 * One saved address.
 *
 * Edit and Remove are **not** built in. They arrived with
 * `src/actions/addresses.ts`, and they arrive through the `actions` slot rather
 * than as props: this component renders a record and knows nothing about who is
 * allowed to change it. `<AddressBook>` fills the slot inside the account
 * portal; anywhere else — a checkout picker, an order's delivery summary — the
 * same card renders with no controls at all and needs no branch to say so.
 *
 * The address body is an LTR island: stored addresses are English/Latin, and
 * street numbers reorder badly when dropped raw into an RTL paragraph.
 */

export interface AddressCardProps {
  address: SavedAddress;
  locale: Locale;
  dict: Dictionary["account"]["addresses"];
  /** Edit / Remove / Make default, when the surface offers them. */
  actions?: ReactNode;
}

/**
 * The country as a reader should see it.
 *
 * Stored as an ISO code, exactly as the checkout stores it, so an address saved
 * in Arabic and read in English names the same country in each. Anything that
 * is not a two-letter code is printed as it was written — rows that predate the
 * convention, and rows the desk may one day type by hand.
 */
function countryText(value: string, locale: Locale): string {
  return value.length === 2 ? countryLabel(value.toUpperCase(), locale) : value;
}

export default function AddressCard({
  address,
  locale,
  dict,
  actions,
}: AddressCardProps) {
  return (
    <article
      className={[
        "relative bg-stone p-9",
        address.isDefault ? "border border-ground-accent/20" : "border border-transparent",
      ].join(" ")}
    >
      {address.isDefault ? (
        <span className="absolute end-5 top-5 border border-ground-accent/30 bg-gold/10 px-2.5 py-1 font-heading text-[9px] tracking-[0.15em] text-ground-accent">
          {dict.default}
        </span>
      ) : null}

      <p className="eyebrow mb-4 text-[9px]">{address.label}</p>

      <p className="mb-2 font-heading text-[15px] text-ground">
        {address.recipient}
      </p>

      <address
        {...ltrIsland(locale)}
        className="text-[13px] not-italic leading-loose text-ground-muted"
      >
        {address.line1}
        <br />
        {address.line2 ? (
          <>
            {address.line2}
            <br />
          </>
        ) : null}
        {`${address.city}, ${address.state} ${address.postalCode}`}
        <br />
        {countryText(address.country, locale)}
      </address>

      {actions ? (
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ground-border pt-5">
          {actions}
        </div>
      ) : null}
    </article>
  );
}
