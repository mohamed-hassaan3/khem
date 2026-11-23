import { Plus } from "lucide-react";

import AdminOrderList, { orderStatusLabel } from "@/src/components/admin/AdminOrderList";
import {
  AdminEmpty,
  AdminLinkButton,
  AdminPageHeader,
} from "@/src/components/admin/AdminTable";
import FilterChips from "@/src/components/admin/FilterChips";
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
  const filtered = Boolean(status || channel || seen);
  const activeView = seen === "new" ? "new" : seen === "opened" ? "opened" : (status ?? "");

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description="Every sale, online or in store. A manual order takes its units out of stock at once; cancelling or refunding puts them back exactly once."
        action={
          <AdminLinkButton href={`${basePath}/new`}>
            <Plus size={14} strokeWidth={1.5} />
            Manual order
          </AdminLinkButton>
        }
      />

      {/* One row for what to look at: everything, the unopened, or a status. */}
      <FilterChips
        basePath={basePath}
        param="status"
        active={activeView}
        query={query}
        chips={[
          { value: "", label: "All" },
          { value: "new", label: "New", count: unopened, param: "seen" },
          ...STATUSES.map((value) => ({ value, label: orderStatusLabel(value) })),
        ]}
      />

      <FilterChips
        basePath={basePath}
        param="channel"
        active={channel ?? ""}
        query={query}
        chips={[
          { value: "", label: "Online and in store" },
          { value: "ONLINE", label: "Online" },
          { value: "OFFLINE", label: "In store" },
        ]}
      />

      {orders.length === 0 ? (
        <AdminEmpty
          message={
            filtered
              ? "No orders match that filter."
              : "No orders yet. Record the first sale and Today starts filling in."
          }
          action={
            filtered ? undefined : (
              <AdminLinkButton href={`${basePath}/new`}>Record the first order</AdminLinkButton>
            )
          }
        />
      ) : (
        <>
          <p className="mb-2.5 text-[12px] text-ground-muted">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
            {orders.length >= 200 ? " — the 200 most recent" : ""}
            {filtered ? " matching" : ""}
          </p>
          <AdminOrderList orders={orders} locale={activeLocale} />
        </>
      )}
    </>
  );
}
