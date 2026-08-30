import Price from "@/src/components/ecommerce/Price";
import { formatAccountDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";
import type { CustomerCredit } from "@/src/types/credit";

/**
 * One credit — what it is worth, where it came from, how long it lasts.
 *
 * Each credit gets its own card rather than dissolving into a balance, because
 * each is its own instrument: earned by one Discovery Set unit, spent whole,
 * and expiring on its own sixty-day clock. Two credits with different expiry
 * dates summed into one number would hide the only fact that requires the
 * customer to act.
 *
 * `PENDING_DELIVERY` is why the card names its state in words as well as in a
 * chip. A credit whose Set has not been marked delivered is not spendable and
 * has no expiry at all, and a customer looking at it deserves to be told why
 * rather than left to wonder what is wrong with it.
 */

export interface CreditCardProps {
  credit: CustomerCredit;
  locale: Locale;
  dict: Dictionary["account"]["vouchers"]["credit"];
}

export default function CreditCard({ credit, locale, dict }: CreditCardProps) {
  const isAvailable = credit.status === "AVAILABLE";
  const isSpent = credit.status === "REDEEMED" || credit.status === "EXPIRED" || credit.status === "CANCELLED";

  /*
   * The face value while the credit still stands, and the remaining balance
   * once it does not — a redeemed credit showing its original amount would read
   * as money still on the table.
   */
  const amount = isSpent ? credit.balanceInCents : credit.amountInCents;

  const timing =
    credit.status === "PENDING_DELIVERY"
      ? dict.awaitingDelivery
      : credit.expiresAt
        ? interpolate(dict.expires, {
            date: formatAccountDate(credit.expiresAt, locale),
          })
        : null;

  return (
    <article
      className={[
        "flex flex-col gap-4 border px-6 py-6",
        isAvailable ? "border-ground-accent/25 bg-gold/6" : "border-ground-border bg-stone",
        isSpent ? "opacity-55" : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p
          className={[
            "font-heading text-2xl font-semibold",
            isAvailable ? "text-ground-accent" : "text-ground-muted",
          ].join(" ")}
        >
          <Price cents={amount} />
        </p>

        <span
          className={[
            "shrink-0 border px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.16em]",
            isAvailable ? "border-ground-accent/40 text-ground-accent" : "border-ground-border text-ground-muted",
          ].join(" ")}
        >
          {dict.status[credit.status]}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 text-[12px] leading-relaxed text-ground-muted">
        {timing ? <p>{timing}</p> : null}

        {/*
          * `dir="auto"` rather than an LTR island: this is a translated
          * sentence with a Latin order number inside it, so the base direction
          * must come from the prose while the number keeps its own run.
          */}
        {credit.sourceOrderNumber ? (
          <p dir="auto">
            {interpolate(dict.fromOrder, { order: credit.sourceOrderNumber })}
          </p>
        ) : null}
      </div>
    </article>
  );
}
