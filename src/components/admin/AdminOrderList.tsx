import { ChevronRight } from "lucide-react";

import AdminLink from "@/src/components/admin/AdminLink";
import { egp } from "@/src/lib/admin/money";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { SHOP_TIME_ZONE } from "@/src/lib/shop-time";
import type { OrderStatus } from "@/src/types/account";
import type { AdminOrderSummary } from "@/src/types/order";

/**
 * The desk's order line — Today's latest orders and the order book share it
 * (prompts/admin-redesign-stage-6.md, 6b).
 *
 * One row per order at every width: number and total on the first line,
 * status, customer, date and item count on the second. The whole row opens the
 * order, so on a phone the target is the full card rather than a small "Open".
 */

const STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  PROCESSING: { label: "Preparing", tone: "border-gold/50 text-ground-accent" },
  SHIPPED: { label: "Shipped", tone: "border-info/40 text-info" },
  DELIVERED: { label: "Delivered", tone: "border-success/40 text-success" },
  CANCELLED: { label: "Cancelled", tone: "border-danger/40 text-danger" },
  REFUNDED: { label: "Refunded", tone: "border-ground-border text-ground-muted" },
};

export function orderStatusLabel(status: OrderStatus): string {
  return STATUS[status].label;
}

export function AdminOrderStatus({ status }: { status: OrderStatus }) {
  const { label, tone } = STATUS[status];
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-[11px] ${tone}`}>
      {label}
    </span>
  );
}

function placedOn(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: SHOP_TIME_ZONE,
  }).format(new Date(iso));
}

export default function AdminOrderList({
  orders,
  locale,
}: {
  orders: readonly AdminOrderSummary[];
  locale: Locale;
}) {
  return (
    <ul data-admin-results="" className="overflow-hidden rounded-lg border border-ground-border bg-stone">
      {orders.map((order) => {
        const unopened = order.firstOpenedAt === null;
        return (
          <li key={order.id} className="border-b border-ground-border last:border-b-0">
            <AdminLink
              href={localizePath(locale, `/admin/orders/${order.orderNumber}`)}
              className="flex min-h-16 items-center gap-3 px-4 py-3 no-underline transition-colors duration-300 hover:bg-ground-bg/60"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="font-heading text-[14px] text-ground">{order.orderNumber}</span>
                  {unopened ? (
                    <span
                      title="Nobody at the desk has opened this order yet"
                      className="rounded bg-ground-accent px-1.5 py-px text-[10px] text-ground-bg"
                    >
                      New
                    </span>
                  ) : null}
                  <span className="ms-auto whitespace-nowrap font-heading text-[14px] text-ground-accent">
                    {egp(order.totalInCents)}
                  </span>
                </span>
                <span className="mt-1.5 flex min-w-0 items-center gap-2">
                  <AdminOrderStatus status={order.status} />
                  <span className="truncate text-[12px] text-ground-muted">
                    {/* `bdi`: an Arabic name must not reorder the date after it. */}
                    <bdi>{order.customerName}</bdi> · {placedOn(order.placedAt)} · {order.itemCount}{" "}
                    {order.itemCount === 1 ? "item" : "items"}
                    {order.channel === "OFFLINE" ? " · in store" : ""}
                  </span>
                </span>
              </span>
              <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-ground-subtle rtl:rotate-180" />
            </AdminLink>
          </li>
        );
      })}
    </ul>
  );
}
