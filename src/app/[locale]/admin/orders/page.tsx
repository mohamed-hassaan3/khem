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
import {
  countUnopenedOrders,
  listAdminOrders,
  type OrderSeenFilter,
} from "@/src/services/admin/orders";
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

/**
 * Whether anybody has looked at the order yet.
 *
 * A third axis rather than a seventh status, because it is not one: an order
 * can be shipped and still never have been read on this screen. See
 * `supabase/sql/0023_order_opened.sql`.
 */
const SEEN: readonly OrderSeenFilter[] = ["new", "opened"];

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
  const seenParam = readParam(query.seen);

  // An unknown value in the URL filters by nothing rather than throwing — a
  // hand-edited address should degrade to the full list.
  const status = STATUSES.find((value) => value === statusParam);
  const channel = CHANNELS.find((value) => value === channelParam);
  const seen = SEEN.find((value) => value === seenParam);

  // The count is deliberately unfiltered: the chip says how much unopened work
  // exists in total, which is the figure the dashboard tile prints. A number
  // that shrank as somebody narrowed by status would answer a question nobody
  // asked.
  const [orders, unopened] = await Promise.all([
    listAdminOrders({ status, channel, seen }),
    countUnopenedOrders(),
  ]);

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

      <FilterChips
        basePath={basePath}
        param="seen"
        active={seen ?? ""}
        query={query}
        chips={[
          { value: "", label: "Opened or not" },
          { value: "new", label: "New", count: unopened },
          { value: "opened", label: "Opened" },
        ]}
      />

      {orders.length === 0 ? (
        <AdminEmpty
          message={
            status || channel || seen
              ? "No orders match that filter."
              : "No orders yet. Record the first sale and the charts on the dashboard start filling in."
          }
          action={
            status || channel || seen ? undefined : (
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
                {/*
                  Marked beside the number rather than in the Status column, so
                  it cannot be read as a seventh status — it is a fact about the
                  desk, not about the order.
                */}
                {order.firstOpenedAt === null ? (
                  <span
                    title="Nobody at the desk has opened this order yet"
                    className="mt-2 inline-block border border-gold/40 px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.2em] text-gold"
                  >
                    New
                  </span>
                ) : null}
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
