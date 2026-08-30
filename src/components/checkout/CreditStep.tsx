"use client";

/**
 * Choosing a Discovery Credit to spend.
 *
 * Rendered only for a signed-in customer who actually holds one — a credit
 * belongs to an account and is not transferable, so a guest never sees this
 * step at all.
 *
 * ## The amount shown here is an estimate
 *
 * It is `min(credit, subtotal)`, the same formula `place_order()` applies, but
 * computed from a bag that lives in the browser. The **server** decides what is
 * actually taken off, under a row lock, against the order it is writing. If the
 * two ever disagree the server is right, and what the customer is charged is
 * what it wrote — which is why the confirmation reads the order back rather
 * than echoing this number.
 *
 * ## Eligibility is not decided here
 *
 * A credit needs a full-size fragrance in the bag, and needs its Discovery Set
 * delivered. Both are checked server-side. This component does not hide credits
 * that would be refused: a customer who picks one and is told *why* it cannot
 * be used has learned something, where a silently absent option teaches nothing.
 */

import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useFormatPrice } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";

export interface SpendableCredit {
  id: string;
  amountInCents: number;
  balanceInCents: number;
  expiresAt: string | null;
}

export default function CreditStep({
  credits,
  selectedId,
  onSelect,
  subtotalInCents,
  locale,
}: {
  credits: readonly SpendableCredit[];
  selectedId: string;
  onSelect: (id: string) => void;
  subtotalInCents: number;
  locale: Locale;
}) {
  const dict = useDictionary();
  const formatPrice = useFormatPrice();
  const copy = dict.checkout.credit;

  if (credits.length === 0) return null;

  const selected = credits.find((credit) => credit.id === selectedId) ?? null;
  const forfeits = selected !== null && selected.balanceInCents > subtotalInCents;

  return (
    <section className="mt-12">
      <h2 className="font-heading text-lg font-normal tracking-[0.1em] text-ground">
        {copy.heading}
      </h2>
      <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ground-muted">
        {copy.lede}
      </p>

      <div className="mt-6 space-y-3">
        {credits.map((credit) => {
          const active = credit.id === selectedId;

          return (
            <button
              key={credit.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(credit.id)}
              className={`flex w-full items-baseline justify-between gap-4 border px-5 py-4 text-start transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                active
                  ? "border-gold/50 bg-gold/10"
                  : "border-ground-border hover:border-ground-accent/30"
              }`}
            >
              <span>
                <span
                  className={`block font-heading text-[12px] tracking-[0.1em] ${
                    active ? "text-ground-accent" : "text-ground-muted"
                  }`}
                >
                  {interpolate(copy.use, {
                    amount: formatPrice(
                      Math.min(credit.balanceInCents, subtotalInCents),
                    ),
                  })}
                </span>
                {credit.expiresAt ? (
                  <span className="mt-1 block text-[11px] tracking-wide text-ground-muted/70">
                    {interpolate(copy.expires, {
                      date: new Intl.DateTimeFormat(
                        locale === "ar" ? "ar-EG" : "en-GB",
                        { day: "numeric", month: "long", timeZone: "UTC" },
                      ).format(new Date(credit.expiresAt)),
                    })}
                  </span>
                ) : null}
              </span>

              <span className="font-heading text-[12px] tracking-[0.1em] text-ground-muted">
                {formatPrice(credit.balanceInCents)}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          aria-pressed={selectedId === ""}
          onClick={() => onSelect("")}
          className={`w-full border px-5 py-4 text-start font-heading text-[12px] tracking-[0.1em] transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            selectedId === ""
              ? "border-gold/50 bg-gold/10 text-ground-accent"
              : "border-ground-border text-ground-muted hover:border-ground-accent/30"
          }`}
        >
          {copy.none}
        </button>
      </div>

      {forfeits ? (
        <p className="mt-4 text-[12px] leading-relaxed text-warning">
          {copy.forfeitNotice}
        </p>
      ) : null}

      {selected ? (
        <p className="mt-3 text-[11px] leading-relaxed text-ground-muted/70">
          {copy.deliveryStillCharged}
        </p>
      ) : null}
    </section>
  );
}
