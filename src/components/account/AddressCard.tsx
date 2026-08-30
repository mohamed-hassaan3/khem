import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import type { SavedAddress } from "@/src/types/account";

/**
 * One saved address.
 *
 * The Edit and Remove controls the original design carried are **not** here.
 * There is no `Address` table and no Server Action behind them, so both would
 * be buttons that silently do nothing — AGENTS.md §1.4. They return in the
 * same change that gives `src/services/account.ts` a real query, at which
 * point this file gains two form actions and nothing else moves.
 *
 * The address body is an LTR island: stored addresses are English/Latin, and
 * street numbers reorder badly when dropped raw into an RTL paragraph.
 */

export interface AddressCardProps {
  address: SavedAddress;
  locale: Locale;
  dict: Dictionary["account"]["addresses"];
}

export default function AddressCard({
  address,
  locale,
  dict,
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
        {address.country}
      </address>
    </article>
  );
}
