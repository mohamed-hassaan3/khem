import Price from "@/src/components/ecommerce/Price";
import { formatAccountDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import type { CreditLedgerEntry } from "@/src/types/credit";
import type { RewardLedgerEntry } from "@/src/types/rewards";

/**
 * Everything that moved in the wallet — credit and points — as one list,
 * newest first.
 *
 * It replaces two four-column tables that scrolled sideways on a phone. Each
 * row keeps every fact the tables held: the date, what happened (worded by the
 * ledgers' existing `reason` copy), which instrument (the tag), and the signed
 * amount at the reading end. Credit is money (`<Price>`); points are a count.
 *
 * The sign is a character beside the amount, never folded into it: `<Price>`
 * formats a magnitude, and a minus inside a currency string lands on the wrong
 * side of the symbol in half the supported locales.
 */
type Row =
  | { type: "credit"; entry: CreditLedgerEntry }
  | { type: "points"; entry: RewardLedgerEntry };

export interface WalletActivityProps {
  credit: readonly CreditLedgerEntry[];
  points: readonly RewardLedgerEntry[];
  locale: Locale;
  dict: Dictionary["account"];
  /** Most rows to show; the ledgers can be long. */
  limit?: number;
}

function describeCredit(entry: CreditLedgerEntry, dict: Dictionary["account"]["vouchers"]["ledger"]): string {
  if (entry.orderNumber === null) return dict.reason[`${entry.kind}Plain`];
  return interpolate(dict.reason[entry.kind], { order: entry.orderNumber });
}

function describePoints(entry: RewardLedgerEntry, dict: Dictionary["account"]["vouchers"]["rewardLedger"]): string {
  if (entry.orderNumber === null) return dict.reason[`${entry.source}Plain`];
  return interpolate(dict.reason[entry.source], { order: entry.orderNumber });
}

export default function WalletActivity({ credit, points, locale, dict, limit = 12 }: WalletActivityProps) {
  const hub = dict.hub.wallet;
  const rows: Row[] = [
    ...credit.map((entry): Row => ({ type: "credit", entry })),
    ...points.map((entry): Row => ({ type: "points", entry })),
  ]
    .sort((a, b) => b.entry.occurredAt.localeCompare(a.entry.occurredAt))
    .slice(0, limit);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-ground-border px-5 py-6 text-[12px] text-ground-muted">
        {hub.noActivity}
      </p>
    );
  }

  return (
    <ul className="overflow-hidden rounded-lg border border-ground-border bg-stone">
      {rows.map((row) => {
        const isCredit = row.type === "credit";
        const amount = isCredit ? row.entry.amountInCents : row.entry.amount;
        const positive = amount >= 0;
        const sentence = isCredit
          ? describeCredit(row.entry, dict.vouchers.ledger)
          : describePoints(row.entry, dict.vouchers.rewardLedger);
        const note =
          (isCredit && row.entry.kind === "ADJUSTED") ||
          (!isCredit && row.entry.source === "ADMIN_ADJUSTMENT")
            ? row.entry.note
            : null;

        return (
          <li key={`${row.type}:${row.entry.id}`} className="flex items-start gap-3 border-t border-ground-border px-4 py-3 first:border-t-0">
            <div className="min-w-0 flex-1">
              <p dir="auto" className="text-[13px] leading-snug text-ground">
                {sentence}
              </p>
              {note ? <p className="mt-0.5 text-[11px] text-ground-muted">{note}</p> : null}
              <p className="mt-1 flex items-center gap-2 text-[11px] text-ground-muted">
                <span {...ltrIsland(locale)}>{formatAccountDate(row.entry.occurredAt, locale)}</span>
                <span className="rounded border border-ground-border px-1.5 text-[9px] uppercase tracking-[0.14em] rtl:text-[11px] rtl:normal-case rtl:tracking-normal">
                  {isCredit ? hub.tagCredit : hub.tagPoints}
                </span>
              </p>
            </div>
            <p
              {...ltrIsland(locale)}
              className={[
                "shrink-0 whitespace-nowrap font-heading text-[13px] tabular-nums",
                positive ? "text-ground-accent" : "text-ground-muted",
              ].join(" ")}
            >
              <span>{positive ? "+" : "−"}</span>
              {isCredit ? <Price cents={Math.abs(amount)} /> : Math.abs(amount).toLocaleString("en-US")}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
