import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  AdminCell,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import OrderStatusControl from "@/src/components/admin/OrderStatusControl";
import { egp } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getAdminOrder } from "@/src/services/admin/orders";

/**
 * One order.
 *
 * Addressed by `orderNumber` rather than by id: it is the string printed on
 * the receipt and read out over the phone, so it is the one a desk can type
 * into the address bar. The controls still hold the id, because that is what
 * every function in `0015_orders.sql` takes.
 *
 * Line names and prices are the snapshots stored on `OrderItem`, never a fresh
 * lookup — a product renamed or repriced since the sale must still print what
 * was actually sold and charged.
 */

export const dynamic = "force-dynamic";

function label(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function stamp(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <dt className="font-heading text-[9px] uppercase tracking-[0.2em] text-ivory/25">
        {term}
      </dt>
      <dd className="mt-1.5 text-[12px] tracking-wide text-ivory/70">{children}</dd>
    </div>
  );
}

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ locale: string; orderNumber: string }>;
}) {
  const { locale, orderNumber } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const order = await getAdminOrder(decodeURIComponent(orderNumber));
  if (!order) notFound();

  const listPath = localizePath(activeLocale, "/admin/orders");

  return (
    <>
      <Link
        href={listPath}
        className="mb-8 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35 transition-colors duration-300 hover:text-gold"
      >
        <ArrowLeft size={13} strokeWidth={1.25} />
        All orders
      </Link>

      <AdminPageHeader
        title={order.orderNumber}
        description={`${label(order.channel)} · placed ${stamp(order.placedAt)}`}
      />

      <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <AdminTable headers={["Product", "Unit price", "Qty", "Line total"]}>
            {order.lines.map((line) => (
              <AdminRow key={line.id}>
                <AdminCell>
                  <Link
                    href={localizePath(
                      activeLocale,
                      `/admin/products/${line.productSlug}`,
                    )}
                    className="transition-colors duration-300 hover:text-gold"
                  >
                    {line.productName}
                  </Link>
                </AdminCell>
                <AdminCell muted>{egp(line.priceInCents)}</AdminCell>
                <AdminCell muted>{line.quantity}</AdminCell>
                <AdminCell>{egp(line.priceInCents * line.quantity)}</AdminCell>
              </AdminRow>
            ))}
          </AdminTable>

          <dl className="max-w-sm border border-border p-6 text-[12px] tracking-wide">
            <div className="flex justify-between py-1">
              <dt className="text-ivory/35">Subtotal</dt>
              <dd className="text-ivory/70">{egp(order.subtotalInCents)}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-ivory/35">Delivery</dt>
              <dd className="text-ivory/70">{egp(order.shipInCents)}</dd>
            </div>
            <div className="mt-3 flex justify-between border-t border-border pt-3">
              <dt className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
                Total
              </dt>
              <dd className="font-heading text-[13px] tracking-[0.1em] text-gold">
                {egp(order.totalInCents)}
              </dd>
            </div>
          </dl>

          {order.stockReleasedAt ? (
            <div className="border border-border bg-ivory/2 p-6">
              <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
                Stock returned
              </p>
              <p className="mt-3 text-[12px] leading-relaxed text-ivory/40">
                These units went back into the website&rsquo;s inventory on{" "}
                {stamp(order.stockReleasedAt)}. They are returned once, so
                moving this order between cancelled and refunded does not add
                them again.
              </p>
            </div>
          ) : null}
        </div>

        <aside className="space-y-8">
          <div className="border border-border bg-ivory/2 p-6">
            <dl>
              <Detail term="Customer">{order.customerName}</Detail>
              {order.customerEmail ? (
                <Detail term="Email">{order.customerEmail}</Detail>
              ) : null}
              {order.customerPhone ? (
                <Detail term="Phone">{order.customerPhone}</Detail>
              ) : null}
              <Detail term="Status">{label(order.status)}</Detail>
              <Detail term="Payment">{label(order.paymentStatus)}</Detail>
              {order.note ? <Detail term="Desk note">{order.note}</Detail> : null}
            </dl>
          </div>

          <div className="border border-border bg-ivory/2 p-6">
            <OrderStatusControl
              orderId={order.id}
              status={order.status}
              paymentStatus={order.paymentStatus}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
