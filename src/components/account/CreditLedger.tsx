import Price from "@/src/components/ecommerce/Price";
import { formatAccountDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";
import type { CreditLedgerEntry } from "@/src/types/credit";

/**
 * Where the credit came from and where it went.
 *
 * The ledger is append-only and signed (`supabase/sql/0026_discovery_credits.sql`):
 * EARNED and REFUNDED add, USED and EXPIRED subtract, and a correction is a new
 * ADJUSTED row rather than an edit. This table is that record read back, in the
 * same order the customer would tell the story — newest first.
 *
 * **The description is composed here, not read from the row.** `note` is house
 * copy written in English by a SQL function ("Discovery Set purchase"), and
 * printing it on the Arabic tree would leave one untranslated line in the
 * middle of a translated page. The kind is a closed union, so the dictionary
 * can carry a sentence for each and a sixth kind becomes a compile error.
 *
 * The one exception is an ADJUSTED row, where the desk's note is the only
 * explanation that exists — that prints beneath the line, `dir="auto"`, because
 * whether it is Arabic or English is a fact about the row.
 */

export interface CreditLedgerProps {
  entries: readonly CreditLedgerEntry[];
  locale: Locale;
  dict: Dictionary["account"]["vouchers"]["ledger"];
}

/** What this movement was, in words, with the order it names where there is one. */
function describe(
  entry: CreditLedgerEntry,
  dict: CreditLedgerProps["dict"],
): string {
  if (entry.orderNumber === null) return dict.reason[`${entry.kind}Plain`];
  return interpolate(dict.reason[entry.kind], { order: entry.orderNumber });
}

export default function CreditLedger({ entries, locale, dict }: CreditLedgerProps) {
  if (entries.length === 0) {
    return (
      <p className="border border-border bg-surface/60 px-6 py-8 text-[12px] text-ivory/35">
        {dict.empty}
      </p>
    );
  }

  return (
    /*
     * The table scrolls inside its own frame rather than the page: four columns
     * of prose do not fit a 320px viewport, and a horizontally scrolling
     * document is a worse answer than a horizontally scrolling table.
     */
    <div className="overflow-x-auto border border-border bg-surface/60">
      <table className="w-full min-w-[34rem] border-collapse text-start">
        <thead>
          <tr className="border-b border-border">
            {[dict.date, dict.description, dict.type, dict.amount].map(
              (heading, index) => (
                <th
                  key={heading}
                  scope="col"
                  className={[
                    "px-5 py-4 font-heading text-[10px] uppercase tracking-[0.16em] text-ivory/30",
                    // The amount column is numeric and reads from the far edge.
                    index === 3 ? "text-end" : "text-start",
                  ].join(" ")}
                >
                  {heading}
                </th>
              ),
            )}
          </tr>
        </thead>

        <tbody>
          {entries.map((entry) => {
            const isCredit = entry.amountInCents >= 0;

            return (
              <tr key={entry.id} className="border-b border-border last:border-b-0">
                <td className="whitespace-nowrap px-5 py-4 text-[12px] text-ivory/40">
                  {formatAccountDate(entry.occurredAt, locale)}
                </td>

                <td className="px-5 py-4 text-[12px] text-ivory/70" dir="auto">
                  {describe(entry, dict)}

                  {entry.kind === "ADJUSTED" && entry.note ? (
                    <span className="mt-1 block text-[11px] text-ivory/35">
                      {entry.note}
                    </span>
                  ) : null}
                </td>

                <td className="whitespace-nowrap px-5 py-4">
                  <span className="border border-border px-2.5 py-1 font-heading text-[10px] uppercase tracking-[0.14em] text-ivory/35">
                    {dict.kind[entry.kind]}
                  </span>
                </td>

                <td
                  className={[
                    "whitespace-nowrap px-5 py-4 text-end font-heading text-[13px] tabular-nums",
                    isCredit ? "text-gold" : "text-ivory/45",
                  ].join(" ")}
                >
                  {/*
                   * The sign is rendered as a character beside the amount
                   * rather than folded into it: `<Price>` formats a magnitude,
                   * and a minus sign inside a currency string lands on the
                   * wrong side of the symbol in half the supported locales.
                   *
                   * Not `aria-hidden`: whether the house added or took away is
                   * the single most important thing about the row, and the
                   * colour that says so to the eye says nothing to a reader.
                   */}
                  <span>{isCredit ? "+" : "−"}</span>
                  <Price cents={Math.abs(entry.amountInCents)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
