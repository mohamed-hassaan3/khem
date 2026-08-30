/**
 * A stock count and what it means, in one mark.
 *
 * The number alone made an editor do the comparison in their head on every
 * row — and do it against a threshold that used to live inside a storefront
 * component. `stockState()` is now the single answer to "is this low", so this
 * chip and the "Only 2 remaining" line on the product page cannot disagree.
 */

import { stockState } from "@/src/lib/inventory";

export default function StockChip({ inventory }: { inventory: number }) {
  const state = stockState(inventory);

  if (state === "out") {
    return (
      <span className="inline-block border border-danger/40 px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] text-danger">
        Out of stock
      </span>
    );
  }

  if (state === "low") {
    return (
      <span className="inline-block border border-warning/40 px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] text-warning">
        Low · {inventory}
      </span>
    );
  }

  return <span className="text-[12px] tracking-wide text-ground-muted">{inventory}</span>;
}
