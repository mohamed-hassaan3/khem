import { formatAccountDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";
import type { RewardLedgerEntry } from "@/src/types/rewards";

/**
 * Where the points came from and where they went.
 *
 * `CreditLedger`'s twin, deliberately: the ledger is append-only and signed
 * (`supabase/sql/0059_rewards.sql`), earning adds and spending subtracts, and a
 * correction is a new row rather than an edit. This is that record read back,
 * newest first.
 *
 * **The description is composed here, not read from the row.** `note` is house
 * copy written in English by a SQL function ("Earned on order"), and printing it
 * on the Arabic tree would leave one untranslated line in the middle of a
 * translated page. `source` is a closed union, so the dictionary carries a
 * sentence for each and a tenth source becomes a compile error.
 *
 * The one exception is an `ADMIN_ADJUSTMENT`, where the desk's note is the only
 * explanation that exists — that prints beneath the line, `dir="auto"`, because
 * whether it is Arabic or English is a fact about the row. The `actor` behind it
 * is not carried this far: it names a member of the house, which is the desk's
 * business and not the customer's.
 */

export interface RewardLedgerProps {
  entries: readonly RewardLedgerEntry[];
  locale: Locale;
  dict: Dictionary["account"]["vouchers"]["rewardLedger"];
}

function describe(
  entry: RewardLedgerEntry,
  dict: RewardLedgerProps["dict"],
): string {
  if (entry.orderNumber === null) return dict.reason[`${entry.source}Plain`];
  return interpolate(dict.reason[entry.source], { order: entry.orderNumber });
}

export default function RewardLedger({
  entries,
  locale,
  dict,
}: RewardLedgerProps) {
  if (entries.length === 0) {
    return (
      <p className="border border-ground-border bg-stone px-6 py-8 text-[12px] text-ground-muted">
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
    <div className="overflow-x-auto border border-ground-border bg-stone">
      <table className="w-full min-w-[34rem] border-collapse text-start">
        <thead>
          <tr className="border-b border-ground-border">
            {[dict.date, dict.description, dict.type, dict.amount].map(
              (heading, index) => (
                <th
                  key={heading}
                  scope="col"
                  className={[
                    "px-5 py-4 font-heading text-[10px] uppercase tracking-[0.16em] text-ground-muted/70",
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
            const earned = entry.amount >= 0;

            return (
              <tr
                key={entry.id}
                className="border-b border-ground-border last:border-b-0"
              >
                <td className="whitespace-nowrap px-5 py-4 text-[12px] text-ground-muted">
                  {formatAccountDate(entry.occurredAt, locale)}
                </td>

                <td className="px-5 py-4 text-[12px] text-ground-muted" dir="auto">
                  {describe(entry, dict)}

                  {entry.source === "ADMIN_ADJUSTMENT" && entry.note ? (
                    <span className="mt-1 block text-[11px] text-ground-muted">
                      {entry.note}
                    </span>
                  ) : null}
                </td>

                <td className="whitespace-nowrap px-5 py-4">
                  <span className="border border-ground-border px-2.5 py-1 font-heading text-[10px] uppercase tracking-[0.14em] text-ground-muted">
                    {dict.kind[entry.source]}
                  </span>
                </td>

                <td
                  className={[
                    "whitespace-nowrap px-5 py-4 text-end font-heading text-[13px] tabular-nums",
                    earned ? "text-ground-accent" : "text-ground-muted",
                  ].join(" ")}
                >
                  {/*
                   * The sign is a character beside the number rather than part
                   * of it, matching `CreditLedger`. Not `aria-hidden`: whether
                   * the house added or took away is the most important thing
                   * about the row, and the colour that says so to the eye says
                   * nothing to a reader.
                   */}
                  {earned ? "+" : "−"}
                  {Math.abs(entry.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
