import CopyButton from "@/src/components/account/CopyButton";
import { formatOrderDate } from "@/src/components/account/OrderCard";
import OrderRail from "@/src/components/account/OrderRail";
import OrderThumb from "@/src/components/account/OrderThumb";
import Price from "@/src/components/ecommerce/Price";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import type { OrderSummary } from "@/src/types/account";

/**
 * Home's order card: the order that is still moving, with its rail.
 *
 * When nothing is in progress the newest order takes the place under
 * "Latest order", so a returning customer still sees where their last parcel
 * ended up. The page decides which; this component only draws it.
 *
 * Its own heading row is part of the component so the desktop grid can place
 * the whole block in one cell.
 */
export interface OrderSpotlightProps {
  order: OrderSummary;
  heading: string;
  locale: Locale;
  dict: Dictionary["account"];
}

export default function OrderSpotlight({ order, heading, locale, dict }: OrderSpotlightProps) {
  const hub = dict.hub;
  const names = order.lines.map((line) => line.productName).join(" · ");

  return (
    <section className="flex h-full flex-col">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="font-heading text-[15px] font-medium tracking-[0.06em] text-ground rtl:text-[19px] rtl:tracking-normal">
          {heading}
        </h2>
        <LocaleLink
          href={`${ACCOUNT_PATHS.orders}#${order.orderNumber}`}
          className="text-[11px] uppercase tracking-[0.14em] text-ground-accent no-underline transition-colors duration-300 hover:text-ground rtl:text-[12px] rtl:normal-case rtl:tracking-normal"
        >
          {hub.allOrders}
        </LocaleLink>
      </div>

      <article className="acct-card flex flex-1 flex-col rounded-lg border border-ground-border bg-stone p-4 lg:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p {...ltrIsland(locale)} className="font-heading text-[14px] tracking-[0.04em] text-ground rtl:text-right">
              {order.orderNumber}
            </p>
            <p className="mt-1 text-[11px] text-ground-muted rtl:text-[12px]">
              {interpolate(hub.placed, { date: formatOrderDate(order.placedAt, locale) })}
            </p>
          </div>
          <Price
            cents={order.totalInCents}
            className="whitespace-nowrap font-heading text-[16px] text-ground-accent lg:text-[18px]"
          />
        </div>

        <div className="my-5 lg:my-7">
          <OrderRail
            status={order.status}
            events={order.events}
            locale={locale}
            dict={dict.orders.tracker}
            showDates
          />
        </div>

        <div className="mt-auto flex items-center gap-3 border-t border-ground-border pt-3.5">
          <span className="flex gap-1.5">
            {order.lines.slice(0, 3).map((line, index) => (
              <OrderThumb key={`${line.productSlug ?? line.productName}-${index}`} src={line.imageUrl} size="sm" />
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span {...ltrIsland(locale)} className="block truncate text-[12px] text-ground rtl:text-right">
              {names}
            </span>
            {order.trackingCode ? (
              <span className="mt-0.5 block truncate text-[11px] text-ground-muted">
                {interpolate(hub.tracking, { code: "" })}
                <span {...ltrIsland(locale)}>{order.trackingCode}</span>
              </span>
            ) : null}
          </span>
          {order.trackingCode ? (
            <CopyButton
              variant="icon"
              value={order.trackingCode}
              label={interpolate(hub.copyTracking, { code: order.trackingCode })}
              copiedText={hub.copied}
              failedText={hub.copyFailed}
            />
          ) : null}
        </div>
      </article>
    </section>
  );
}
