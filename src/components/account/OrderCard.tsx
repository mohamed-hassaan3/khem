import { ChevronDown, Truck } from "lucide-react";

import CopyButton from "@/src/components/account/CopyButton";
import OrderRail, { isActiveOrder } from "@/src/components/account/OrderRail";
import OrderThumb from "@/src/components/account/OrderThumb";
import Price from "@/src/components/ecommerce/Price";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import type { OrderSummary } from "@/src/types/account";

/**
 * One order in the history: a one-line summary that opens into the detail.
 *
 * A native `<details>`, so it opens and closes with no JavaScript and is a
 * disclosure to assistive technology for free. The summary row carries what a
 * history is scanned for — number, total, status, date, what was in it — and
 * the body carries what a single order is opened for: the pieces, the
 * timeline, the tracking number.
 *
 * The `id` is the order number: the "Track your order" button in the emails
 * links to `/account/orders#KHEM-2026-1042`, and `<OpenOrderFromHash>` opens
 * the matching card. `scroll-mt` keeps it clear of the fixed header. The list
 * was filtered to this customer on the server before it rendered, so the
 * fragment selects nothing and grants nothing.
 */
export interface OrderCardProps {
  order: OrderSummary;
  locale: Locale;
  dict: Dictionary["account"];
  defaultOpen?: boolean;
}

export function formatOrderDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function StatusChip({
  status,
  label,
}: {
  status: OrderSummary["status"];
  label: string;
}) {
  const tone = isActiveOrder(status)
    ? "border-ground-accent/40 text-ground-accent"
    : status === "CANCELLED" || status === "REFUNDED"
      ? "border-danger/40 text-danger"
      : "border-ground-border text-ground-muted";

  return (
    <span
      className={`inline-flex h-[22px] shrink-0 items-center rounded-full border px-2 text-[9px] uppercase tracking-[0.16em] rtl:text-[11px] rtl:normal-case rtl:tracking-normal ${tone}`}
    >
      {label}
    </span>
  );
}

export default function OrderCard({
  order,
  locale,
  dict,
  defaultOpen = false,
}: OrderCardProps) {
  const hub = dict.hub;
  const items = order.lines
    .map((line) =>
      line.quantity > 1 ? `${line.productName} × ${line.quantity}` : line.productName,
    )
    .join(" · ");
  const [firstLine] = order.lines;

  return (
    <details
      id={order.orderNumber}
      open={defaultOpen}
      className="acct-card group scroll-mt-32 rounded-lg border border-ground-border bg-stone"
    >
      <summary className="flex min-h-[72px] cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
        <OrderThumb src={firstLine?.imageUrl ?? null} size="sm" />

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span {...ltrIsland(locale)} className="font-heading text-[14px] text-ground">
              {order.orderNumber}
            </span>
            <Price
              cents={order.totalInCents}
              className="whitespace-nowrap font-heading text-[14px] text-ground-accent"
            />
          </span>

          <span className="mt-1.5 flex min-w-0 items-center gap-2">
            <StatusChip status={order.status} label={dict.orders.status[order.status]} />
            <span className="truncate text-[11px] text-ground-muted">
              {formatOrderDate(order.placedAt, locale)}
              {items ? (
                <>
                  {" · "}
                  <span {...ltrIsland(locale)}>{items}</span>
                </>
              ) : null}
            </span>
          </span>
        </span>

        <ChevronDown
          size={16}
          strokeWidth={1.25}
          aria-hidden="true"
          className="shrink-0 text-ground-muted transition-transform duration-500 ease-luxury-bezier group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>

      <div className="acct-details-body border-t border-ground-border px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
        <ul className="flex flex-col gap-3">
          {order.lines.map((line, index) => (
            <li key={`${line.productSlug ?? line.productName}-${index}`} className="flex items-center gap-3">
              <OrderThumb src={line.imageUrl} />
              <span {...ltrIsland(locale)} className="min-w-0 flex-1 text-[13px] text-ground rtl:text-right">
                {line.productName}
              </span>
              <span className="text-[12px] text-ground-muted">
                {interpolate(hub.orders.quantity, { count: String(line.quantity) })}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-ground-border pt-4">
          <OrderRail
            status={order.status}
            events={order.events}
            locale={locale}
            dict={dict.orders.tracker}
            variant="vertical"
          />
        </div>

        {order.trackingCode ? (
          <div className="mt-4 flex items-center gap-3 rounded-md border border-ground-border bg-ground-bg px-3 py-2">
            <Truck size={18} strokeWidth={1.25} aria-hidden="true" className="shrink-0 text-ground-accent" />
            <span className="min-w-0 flex-1 truncate text-[12px] text-ground">
              {interpolate(hub.tracking, { code: "" })}
              <span {...ltrIsland(locale)} className="tracking-[0.06em]">
                {order.trackingCode}
              </span>
            </span>
            <CopyButton
              variant="icon"
              value={order.trackingCode}
              label={interpolate(hub.copyTracking, { code: order.trackingCode })}
              copiedText={hub.copied}
              failedText={hub.copyFailed}
            />
          </div>
        ) : null}
      </div>
    </details>
  );
}
