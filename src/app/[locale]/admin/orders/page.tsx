import Link from "next/link";
import { Plus } from "lucide-react";

import {
  AdminCell,
  AdminEmpty,
  AdminLinkButton,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import FilterChips from "@/src/components/admin/FilterChips";
import { egp } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listAdminOrders } from "@/src/services/admin/orders";
import type { OrderStatus } from "@/src/types/account";
import type { OrderChannel } from "@/src/types/order";

/**
 * The order book.
 *
 * `force-dynamic` for the reason the whole dashboard is: a desk that just
 * marked something shipped must not be handed a cached copy of the row it
 * changed.
 *
 * Filtering happens in the query rather than in memory — unlike the catalog
 * lists, which are small and already fetched whole. Status and channel are
 * enum members, so they can be bound with `.eq()` without going anywhere near
 * the string-built filter syntax `src/lib/admin/filter.ts` refuses.
 */

export const dynamic = "force-dynamic";

const STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

const CHANNELS: readonly OrderChannel[] = ["OFFLINE", "ONLINE"];

function readParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : "";
}

function label(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/** Dates are formatted here, never stored formatted. UTC, as they are stored. */
function placedOn(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const statusParam = readParam(query.status);
  const channelParam = readParam(query.channel);

  // An unknown value in the URL filters by nothing rather than throwing — a
  // hand-edited address should degrade to the full list.
  const status = STATUSES.find((value) => value === statusParam);
  const channel = CHANNELS.find((value) => value === channelParam);

  const orders = await listAdminOrders({ status, channel });

  const basePath = localizePath(activeLocale, "/admin/orders");

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description="Every sale, however it came in. Recording one here takes its units out of the website's stock immediately; cancelling or refunding puts them back exactly once."
        action={
          <AdminLinkButton href={`${basePath}/new`}>
            <Plus size={13} strokeWidth={1.25} />
            Record order
          </AdminLinkButton>
        }
      />

      <FilterChips
        basePath={basePath}
        param="status"
        active={status ?? ""}
        query={query}
        chips={[
          { value: "", label: "All" },
          ...STATUSES.map((value) => ({ value, label: label(value) })),
        ]}
      />

      <FilterChips
        basePath={basePath}
        param="channel"
        active={channel ?? ""}
        query={query}
        chips={[
          { value: "", label: "Every channel" },
          ...CHANNELS.map((value) => ({ value, label: label(value) })),
        ]}
      />

      {orders.length === 0 ? (
        <AdminEmpty
          message={
            status || channel
              ? "No orders match that filter."
              : "No orders yet. Record the first sale and the charts on the dashboard start filling in."
          }
          action={
            status || channel ? undefined : (
              <AdminLinkButton href={`${basePath}/new`}>
                Record the first order
              </AdminLinkButton>
            )
          }
        />
      ) : (
        <AdminTable
          headers={[
            "Order",
            "Customer",
            "Placed",
            "Items",
            "Total",
            "Payment",
            "Status",
            { label: "Open", hidden: true },
          ]}
        >
          {orders.map((order) => (
            <AdminRow key={order.id}>
              <AdminCell>
                <span className="block font-heading text-[11px] tracking-[0.1em]">
                  {order.orderNumber}
                </span>
                <span className="mt-1 block text-[10px] tracking-wide text-ivory/25">
                  {order.channel.toLowerCase()}
                </span>
              </AdminCell>
              <AdminCell>{order.customerName}</AdminCell>
              <AdminCell muted>{placedOn(order.placedAt)}</AdminCell>
              <AdminCell muted>{order.itemCount}</AdminCell>
              <AdminCell>{egp(order.totalInCents)}</AdminCell>
              <AdminCell>
                <span
                  className={
                    order.paymentStatus === "PAID"
                      ? "text-success"
                      : order.paymentStatus === "FAILED"
                        ? "text-danger"
                        : "text-ivory/35"
                  }
                >
                  {label(order.paymentStatus)}
                </span>
              </AdminCell>
              <AdminCell>
                <span
                  className={`inline-block border px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] ${
                    order.status === "CANCELLED" || order.status === "REFUNDED"
                      ? "border-border text-ivory/30"
                      : order.status === "DELIVERED"
                        ? "border-success/40 text-success"
                        : "border-gold/40 text-gold"
                  }`}
                >
                  {label(order.status)}
                </span>
              </AdminCell>
              <AdminCell>
                <Link
                  href={`${basePath}/${order.orderNumber}`}
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-gold/70 transition-colors duration-300 hover:text-gold"
                >
                  Open
                </Link>
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </>
  );
}
