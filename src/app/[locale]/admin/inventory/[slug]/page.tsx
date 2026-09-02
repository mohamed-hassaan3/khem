import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AdminCell,
  AdminEmpty,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listInventoryMovements } from "@/src/services/admin/analytics";
import { getAdminProduct } from "@/src/services/admin/catalog";
import { INVENTORY_ACTION_LABEL } from "@/src/lib/inventory";
import type { InventoryMovement } from "@/src/types/order";

/**
 * One product's stock history.
 *
 * The audit trail the brief asked for: "Do not simply overwrite stock
 * quantities without recording the movement." Every row here was written by a
 * database function inside the same transaction as the change it describes —
 * `place_order()`, `restock_order()`, or one of the desk operations in
 * `src/actions/admin/inventory.ts` — so the ledger and the counters cannot
 * disagree.
 *
 * Read-only on purpose. Stock is changed on the inventory table or by a sale;
 * a history that could be edited would not be a history.
 */
export const dynamic = "force-dynamic";


export default async function InventoryHistoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [product, movements] = await Promise.all([
    getAdminProduct(slug),
    listInventoryMovements(slug),
  ]);

  if (!product) notFound();

  return (
    <>
      <AdminPageHeader
        title={`${product.name} — stock history`}
        description={`Online ${product.inventoryOnline}, offline ${product.inventoryOffline}. Every movement below carries the figure before and after it, so the counters above can be read back from this list.`}
      />

      <p className="mb-8">
        <Link
          href={localizePath(activeLocale, "/admin/inventory")}
          className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
        >
          Back to inventory
        </Link>
      </p>

      {movements.length === 0 ? (
        <AdminEmpty message="No movements recorded yet." />
      ) : (
        <AdminTable
          headers={["When", "Counter", "Action", "Change", "Before → after", "Reason", "By"]}
        >
          {movements.map((movement: InventoryMovement) => (
            <AdminRow key={movement.id}>
              <AdminCell muted>
                {new Date(movement.createdAt).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </AdminCell>
              <AdminCell muted>
                {movement.channel === "ONLINE" ? "Online" : "Offline"}
              </AdminCell>
              <AdminCell>{INVENTORY_ACTION_LABEL[movement.action]}</AdminCell>
              {/* Signed, and coloured by direction: the sign is the fact an
                  editor scans this column for. */}
              <AdminCell>
                <span
                  className={
                    movement.quantity < 0 ? "text-danger" : "text-success"
                  }
                >
                  {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                </span>
              </AdminCell>
              <AdminCell muted>
                {movement.previousQuantity} → {movement.newQuantity}
              </AdminCell>
              <AdminCell muted>{movement.reason ?? "—"}</AdminCell>
              <AdminCell muted>{movement.actor ?? "System"}</AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </>
  );
}
