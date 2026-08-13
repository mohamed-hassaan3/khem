import { formatPrice } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import type { OrderSummary } from "@/src/types/account";

/**
 * One order in the history list.
 *
 * A Server Component with no state — it renders a record and nothing else.
 *
 * Two things the previous page got wrong and this does not:
 *
 *  - **Dates are formatted, not stored formatted.** `"December 12, 2024"` was
 *    a literal in the data. Here `placedAt` is ISO-8601 and rendered through
 *    `Intl.DateTimeFormat` in the active locale, so Arabic gets Arabic months.
 *  - **Status is translated.** It was a raw English string in a bordered
 *    span; it is now a dictionary lookup keyed by the §9 `OrderStatus` enum,
 *    which means a new status is a compile error rather than a blank chip.
 *
 * Order numbers, tracking codes, and product names are LTR islands: all three
 * are Latin/numeric strings whose character order carries meaning.
 */

export interface OrderCardProps {
  order: OrderSummary;
  locale: Locale;
  dict: Dictionary["account"]["orders"];
}

export default function OrderCard({ order, locale, dict }: OrderCardProps) {
  const placedAt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(order.placedAt));

  const items = order.lines
    .map((line) => (line.quantity > 1
      ? `${line.productName} × ${line.quantity}`
      : line.productName))
    .join(" · ");

  return (
    <article className="grid grid-cols-1 items-start gap-6 bg-surface p-8 sm:grid-cols-[1fr_auto]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <span
            {...ltrIsland(locale)}
            className="font-heading text-sm text-ivory"
          >
            {order.orderNumber}
          </span>

          <span className="border border-gold/25 px-2.5 py-0.5 font-heading text-[9px] tracking-[0.15em] text-gold/80">
            {dict.status[order.status]}
          </span>
        </div>

        <p {...ltrIsland(locale)} className="mb-2 text-xs text-ivory/50">
          {items}
        </p>

        <p className="mb-3 text-[11px] text-ivory/25">{placedAt}</p>

        {order.trackingCode ? (
          <p
            {...ltrIsland(locale)}
            className="text-[10px] tracking-[0.08em] text-ivory/25"
          >
            {interpolate(dict.tracking, { code: order.trackingCode })}
          </p>
        ) : null}
      </div>

      <div className="sm:text-end">
        <p className="mb-4 font-heading text-xl text-gold">
          {formatPrice(order.totalInCents)}
        </p>
      </div>
    </article>
  );
}
