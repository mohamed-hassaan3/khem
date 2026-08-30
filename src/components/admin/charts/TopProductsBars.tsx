/**
 * What sold most, as bars.
 *
 * Deliberately *not* lightweight-charts. That library draws time series; a
 * ranked comparison of eight products is a list with proportional rules, and
 * rendering it in CSS keeps this a Server Component with no canvas, no
 * hydration and no second axis to explain.
 *
 * Bars are relative to the leader rather than to a round number: the question
 * this panel answers is "what is carrying the month", which is a comparison
 * between the rows, not against an absolute scale.
 */

import Link from "next/link";

import { egpCompact } from "@/src/lib/admin/money";
import type { ProductSalesRow } from "@/src/types/order";

export default function TopProductsBars({
  rows,
  hrefFor,
}: {
  rows: readonly ProductSalesRow[];
  /** Where a row links — the product's edit screen. */
  hrefFor: (slug: string) => string;
}) {
  const leader = rows.reduce((max, row) => Math.max(max, row.revenueInCents), 0);

  return (
    <ul className="space-y-5">
      {rows.map((row) => {
        // Guarded against a zero leader: every product having sold nothing is
        // the empty state's job, not a division by zero.
        const share = leader > 0 ? (row.revenueInCents / leader) * 100 : 0;

        return (
          <li key={row.productSlug}>
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <Link
                href={hrefFor(row.productSlug)}
                className="text-[12px] tracking-wide text-ground transition-colors duration-300 hover:text-ground-accent"
              >
                {row.productName}
              </Link>
              <span className="shrink-0 font-heading text-[11px] tracking-[0.1em] text-ground-accent">
                {egpCompact(row.revenueInCents)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-ivory/8">
                <div
                  className="h-px bg-gold transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ width: `${Math.max(share, 2)}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-end text-[10px] tracking-wide text-ground-muted">
                {row.units} sold
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
