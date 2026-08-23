import OrderTracker from "@/src/components/account/OrderTracker";
import Price from "@/src/components/ecommerce/Price";
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
 *
 * The `id` is the order number, and it is what the "Track Your Order" button in
 * the emails links to — `/en/account/orders#KHEM-2026-1042`. `scroll-mt` is
 * what stops that landing under the fixed navigation. A fragment never reaches
 * the server, so it selects nothing and grants nothing: the list was already
 * filtered to this customer before it rendered.
 */

export interface OrderCardProps {
  order: OrderSummary;
  locale: Locale;
  dict: Dictionary["account"]["orders"];
  /** The newest order in the list. A marker, not a sort — the service sorts. */
  isLatest?: boolean;
}

export default function OrderCard({
  order,
  locale,
  dict,
  isLatest = false,
}: OrderCardProps) {
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
    <article id={order.orderNumber} className="scroll-mt-32 bg-surface p-8">
      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 sm:grid-cols-[1fr_auto]">
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

            {isLatest ? (
              <span className="font-heading text-[9px] uppercase tracking-[0.2em] text-ivory/30">
                {dict.latest}
              </span>
            ) : null}
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
          <p>
            <Price
              cents={order.totalInCents}
              className="font-heading text-xl text-gold"
            />
          </p>
        </div>
      </div>

      <div className="mt-8 border-t border-border pt-8">
        <OrderTracker
          status={order.status}
          events={order.events}
          locale={locale}
          dict={dict.tracker}
        />
      </div>
    </article>
  );
}
