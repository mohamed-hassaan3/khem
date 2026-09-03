import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  AdminCell,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import MarkOrderOpened from "@/src/components/admin/MarkOrderOpened";
import OrderStatusControl from "@/src/components/admin/OrderStatusControl";
import { egp } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getAdminOrder } from "@/src/services/admin/orders";
import type { OrderShippingAddress } from "@/src/types/order";

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
 * was actually sold and charged. The delivery address is a snapshot for the
 * same reason: it records where a parcel went, not where the customer lives now.
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

/** True when there is anything to print on a parcel. A walk-in has nothing. */
function hasAddress(shipping: OrderShippingAddress): boolean {
  return Object.values(shipping).some((value) => Boolean(value?.trim()));
}

/** The address as a courier reads it: one line per line, empties dropped. */
function addressLines(shipping: OrderShippingAddress): string[] {
  return [
    shipping.line1,
    shipping.line2,
    [shipping.city, shipping.state].filter(Boolean).join(", "),
    [shipping.postalCode, shipping.country].filter(Boolean).join(" "),
  ]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line && line.length > 0));
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-ground-border py-3 last:border-b-0">
      <dt className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
        {term}
      </dt>
      <dd className="mt-1.5 text-[12px] tracking-wide text-ground">{children}</dd>
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
        className="mb-8 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
      >
        <ArrowLeft size={13} strokeWidth={1.25} />
        All orders
      </Link>

      {/*
        Reaching this screen is what "opened" means, so the claim is made here
        and nowhere else. It renders nothing and cannot fail visibly.
      */}
      <MarkOrderOpened
        orderId={order.id}
        alreadyOpened={order.firstOpenedAt !== null}
      />

      <AdminPageHeader
        title={order.orderNumber}
        description={`${label(order.channel)} · placed ${stamp(order.placedAt)}`}
      />

      <div className="grid gap-5 md:gap-8 xl:grid-cols-[1fr_320px]">
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
                    className="transition-colors duration-300 hover:text-ground-accent"
                  >
                    {line.productName}
                  </Link>
                </AdminCell>
                <AdminCell muted>
                  {/*
                    The campaign, as the order recorded it. Printed from the
                    line's own snapshot rather than from whatever promotion is
                    running today — a sale that ended in December must not change
                    what a November invoice says it charged.
                  */}
                  {line.listPriceInCents !== null &&
                  line.listPriceInCents > line.priceInCents ? (
                    <span className="inline-flex items-baseline gap-2">
                      <span className="text-ground-subtle line-through">
                        {egp(line.listPriceInCents)}
                      </span>
                      <span className="text-ground-accent">{egp(line.priceInCents)}</span>
                    </span>
                  ) : (
                    egp(line.priceInCents)
                  )}
                </AdminCell>
                <AdminCell muted>{line.quantity}</AdminCell>
                <AdminCell>{egp(line.priceInCents * line.quantity)}</AdminCell>
              </AdminRow>
            ))}
          </AdminTable>

          <dl className="max-w-sm border border-ground-border p-6 text-[12px] tracking-wide">
            <div className="flex justify-between py-1">
              <dt className="text-ground-muted">Subtotal</dt>
              <dd className="text-ground">{egp(order.subtotalInCents)}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-ground-muted">Delivery</dt>
              <dd className="text-ground">{egp(order.shipInCents)}</dd>
            </div>
            {order.discountInCents > 0 ? (
              <div className="flex justify-between py-1">
                <dt className="text-ground-muted">
                  Discount
                  {order.discountCode ? (
                    <span className="ms-2 text-ground-subtle">{order.discountCode}</span>
                  ) : null}
                </dt>
                <dd className="text-ground-accent">
                  −{egp(order.discountInCents)}
                  {order.discountCode ? (
                    <Link
                      href={localizePath(
                        activeLocale,
                        `/admin/discounts/${order.discountCode}`,
                      )}
                      className="ms-3 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
                    >
                      Code
                    </Link>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {order.creditAppliedInCents > 0 ? (
              <div className="flex justify-between py-1">
                <dt className="text-ground-muted">Discovery credit</dt>
                <dd className="text-ground-accent">
                  −{egp(order.creditAppliedInCents)}
                  {order.creditId ? (
                    <Link
                      href={localizePath(
                        activeLocale,
                        `/admin/credits/${order.creditId}`,
                      )}
                      className="ms-3 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
                    >
                      Ledger
                    </Link>
                  ) : null}
                </dd>
              </div>
            ) : null}
            <div className="mt-3 flex justify-between border-t border-ground-border pt-3">
              <dt className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
                Total
              </dt>
              <dd className="font-heading text-[13px] tracking-[0.1em] text-ground-accent">
                {egp(order.totalInCents)}
              </dd>
            </div>
          </dl>

          {order.stockReleasedAt ? (
            <div className="border border-ground-border bg-ivory/2 p-6">
              <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
                Stock returned
              </p>
              <p className="mt-3 text-[12px] leading-relaxed text-ground-muted">
                These units went back into the website&rsquo;s inventory on{" "}
                {stamp(order.stockReleasedAt)}. They are returned once, so
                moving this order between cancelled and refunded does not add
                them again.
              </p>
            </div>
          ) : null}
        </div>

        <aside className="space-y-8">
          <div className="border border-ground-border bg-ivory/2 p-6">
            <dl>
              <Detail term="Customer">{order.customerName}</Detail>
              {order.customerEmail ? (
                <Detail term="Email">{order.customerEmail}</Detail>
              ) : null}
              {order.customerPhone ? (
                <Detail term="Phone">{order.customerPhone}</Detail>
              ) : null}
              <Detail term="Status">{label(order.status)}</Detail>
              {/*
               * Method and state, together and in that order. They are
               * different questions and the desk has to read both: a cash order
               * is PROCESSING and UNPAID until the courier collects, which is
               * healthy, while a card order in the same state means the money
               * never arrived.
               */}
              <Detail term="Payment">
                {order.paymentMethod === "CARD" ? "Card" : "Cash on delivery"} ·{" "}
                {label(order.paymentStatus)}
                {order.paidAt ? (
                  <span className="block text-ground-muted">
                    Paid {stamp(order.paidAt)}
                  </span>
                ) : null}
              </Detail>
              {order.trackingCode ? (
                <Detail term="Tracking">{order.trackingCode}</Detail>
              ) : null}
              {/*
               * Written out, not one line: this is the block somebody copies
               * onto a parcel, and a comma-joined string is harder to read off
               * a screen than five lines are.
               */}
              {hasAddress(order.shipping) ? (
                <Detail term="Deliver to">
                  {addressLines(order.shipping).map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </Detail>
              ) : null}
              {order.locale === "ar" ? (
                <Detail term="Writes to them in">Arabic</Detail>
              ) : null}
              {order.stripePaymentIntentId ? (
                <Detail term="Stripe intent">
                  <span className="break-all text-ground-muted">
                    {order.stripePaymentIntentId}
                  </span>
                </Detail>
              ) : null}
              {order.note ? <Detail term="Customer note">{order.note}</Detail> : null}
            </dl>
          </div>

          <div className="border border-ground-border bg-ivory/2 p-6">
            <OrderStatusControl
              orderId={order.id}
              status={order.status}
              paymentStatus={order.paymentStatus}
              paymentMethod={order.paymentMethod}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
