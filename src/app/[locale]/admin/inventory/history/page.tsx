import Link from "next/link";

import {
  AdminCell,
  AdminEmpty,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import AdminSearch from "@/src/components/admin/AdminSearch";
import FilterChips from "@/src/components/admin/FilterChips";
import MovementDateRange from "@/src/components/admin/MovementDateRange";
import { matchesTerm, searchTerm } from "@/src/lib/admin/filter";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  INVENTORY_ACTIONS,
  INVENTORY_ACTION_LABEL,
  parseInventoryAction,
  parseInventoryChannel,
} from "@/src/lib/inventory";
import { listMovements } from "@/src/services/admin/analytics";
import { listAdminProducts } from "@/src/services/admin/catalog";
import { listAdminOrders } from "@/src/services/admin/orders";

/**
 * The whole stock ledger, across every product.
 *
 * The per-product view at `/admin/inventory/[slug]` answers "what happened to
 * this bottle"; this answers "what happened today", which is the question an
 * end-of-day check actually asks.
 *
 * ## Where each filter runs
 *
 * Channel, action and date are columns, so they narrow in Postgres — the ledger
 * gains a row per sale and would otherwise be the one screen that got slower
 * every day. The free-text search is different: it matches a **product name** or
 * an **order number**, neither of which lives on `"InventoryMovement"`. Those
 * are resolved here against the catalogue and the order list, and turned into
 * the slug and order-id sets the rows are then matched against — so a search for
 * "Amber" finds movements on a product whose slug is `amber-body-mist`, and a
 * search for an order number finds the sale it caused.
 */
export const dynamic = "force-dynamic";

function readParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : "";
}

/** `YYYY-MM-DD`, or nothing. Anything else is ignored rather than queried. */
function readDate(value: string | string[] | undefined): string | undefined {
  const raw = readParam(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

export default async function InventoryHistoryIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const channel = parseInventoryChannel(readParam(query.channel));
  const action = parseInventoryAction(readParam(query.action));
  const slug = readParam(query.product);
  const from = readDate(query.from);
  const to = readDate(query.to);
  const term = searchTerm(query);

  const [movements, products, orders] = await Promise.all([
    listMovements({
      channel: channel ?? undefined,
      action: action ?? undefined,
      slug: slug || undefined,
      from,
      to,
    }),
    listAdminProducts(),
    // Only needed to resolve an order-number search into ids.
    term.length > 0 ? listAdminOrders() : Promise.resolve([]),
  ]);

  const nameBySlug = new Map(products.map((p) => [p.slug, p.name]));
  const numberById = new Map(orders.map((o) => [o.id, o.orderNumber]));

  /*
   * The search runs last and in memory, over rows the database has already
   * narrowed — it has to, because it spans two tables the ledger only
   * references. Matching the product name, the slug, the order number and the
   * reason together is what makes one box useful for all four.
   */
  const rows =
    term.length === 0
      ? movements
      : movements.filter((movement) =>
          matchesTerm(term, [
            nameBySlug.get(movement.productSlug) ?? "",
            movement.productSlug,
            movement.orderId ? (numberById.get(movement.orderId) ?? "") : "",
            movement.reason ?? "",
          ]),
        );

  const base = localizePath(activeLocale, "/admin/inventory/history");

  // Preserved across chip rows, so channel and action narrow together rather
  // than each wiping the other.
  const carried = {
    ...(channel ? { channel } : {}),
    ...(action ? { action } : {}),
    ...(slug ? { product: slug } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(term ? { q: term } : {}),
  };

  const isFiltered = Object.keys(carried).length > 0;

  return (
    <>
      <AdminPageHeader
        title="Stock history"
        description="Every movement across the catalogue, newest first. Sales come from orders; restocks, transfers and adjustments come from the inventory screen. Nothing changes a count without appearing here."
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          href={localizePath(activeLocale, "/admin/inventory")}
          className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
        >
          Back to inventory
        </Link>

        {isFiltered ? (
          <Link
            href={base}
            className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-gold"
          >
            Clear filters
          </Link>
        ) : null}
      </div>

      <FilterChips
        basePath={base}
        param="channel"
        active={channel ?? ""}
        query={{ ...carried, channel: undefined }}
        chips={[
          { value: "", label: "Both counters" },
          { value: "ONLINE", label: "Online" },
          { value: "OFFLINE", label: "Offline" },
        ]}
      />

      <FilterChips
        basePath={base}
        param="action"
        active={action ?? ""}
        query={{ ...carried, action: undefined }}
        chips={[
          { value: "", label: "All movements" },
          ...INVENTORY_ACTIONS.map((value) => ({
            value,
            label: INVENTORY_ACTION_LABEL[value],
          })),
        ]}
      />

      <MovementDateRange basePath={base} from={from ?? ""} to={to ?? ""} />

      <AdminSearch placeholder="Search by product, order number or reason" />

      {rows.length === 0 ? (
        <AdminEmpty
          message={
            isFiltered
              ? "No movements match those filters."
              : "No stock has moved yet."
          }
        />
      ) : (
        <AdminTable
          headers={[
            "When",
            "Product",
            "Counter",
            "Action",
            "Change",
            "Before → after",
            "Reason",
            "Reference",
            "By",
          ]}
        >
          {rows.map((movement) => (
            <AdminRow key={movement.id}>
              <AdminCell muted>
                {new Date(movement.createdAt).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </AdminCell>
              <AdminCell>
                <Link
                  href={localizePath(
                    activeLocale,
                    `/admin/inventory/${movement.productSlug}`,
                  )}
                  className="transition-colors duration-300 hover:text-ground-accent"
                >
                  {nameBySlug.get(movement.productSlug) ?? movement.productSlug}
                </Link>
              </AdminCell>
              <AdminCell muted>
                {movement.channel === "ONLINE" ? "Online" : "Offline"}
              </AdminCell>
              <AdminCell>{INVENTORY_ACTION_LABEL[movement.action]}</AdminCell>
              <AdminCell>
                <span
                  className={
                    movement.quantity < 0 ? "text-danger" : "text-success"
                  }
                >
                  {movement.quantity > 0
                    ? `+${movement.quantity}`
                    : movement.quantity}
                </span>
              </AdminCell>
              <AdminCell muted>
                {movement.previousQuantity} → {movement.newQuantity}
              </AdminCell>
              <AdminCell muted>{movement.reason ?? "—"}</AdminCell>
              <AdminCell muted>
                {movement.orderId
                  ? (numberById.get(movement.orderId) ?? "Order")
                  : "—"}
              </AdminCell>
              <AdminCell muted>{movement.actor ?? "System"}</AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </>
  );
}
