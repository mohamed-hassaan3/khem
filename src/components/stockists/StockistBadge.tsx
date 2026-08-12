import type { StockistType } from "@/src/types/stockist";

/**
 * The type badge shown against a location.
 *
 * Deliberately hook-free and directive-free so both the Server Component page
 * and the client directory can render it without forking the markup. The label
 * is resolved by the caller — `getDictionary()` on the server, `useDictionary()`
 * in the client — because the badge itself has no business knowing which side
 * of the boundary it is on.
 */

export interface StockistBadgeProps {
  /** Already-translated label from `dict.stockists.types`. */
  label: string;
  type: StockistType;
  /** Tailwind size class for the text, so cards and rows can differ. */
  className?: string;
}

export default function StockistBadge({
  label,
  type,
  className = "text-[9px]",
}: StockistBadgeProps) {
  const isFlagship = type === "flagship";

  return (
    <span
      className={`shrink-0 whitespace-nowrap border px-2.5 py-1 font-heading tracking-[0.15em] ${className} ${
        isFlagship
          ? "border-gold/40 text-gold"
          : "border-white/8 text-ivory/30"
      }`}
    >
      {label}
    </span>
  );
}
