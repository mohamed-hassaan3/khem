import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  AdminCell,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import { AdminOrderStatus } from "@/src/components/admin/AdminOrderList";
import MarkOrderOpened from "@/src/components/admin/MarkOrderOpened";
import OrderStatusControl from "@/src/components/admin/OrderStatusControl";
import { egp } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getAdminOrder } from "@/src/services/admin/orders";
import type { OrderShippingAddress } from "@/src/types/order";
import { SHOP_TIME_ZONE, SHOP_ZONE_LABEL } from "@/src/lib/shop-time";
import { requireAdmin } from "@/src/lib/admin/auth";

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
    timeZone: SHOP_TIME_ZONE,
  }).format(new Date(iso)) + ` ${SHOP_ZONE_LABEL}`;
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
      <dt className="text-[12px] text-ground-muted">
        {term}
      </dt>
      <dd className="mt-1 text-[14px] text-ground">{children}</dd>
    </div>
  );
}

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ locale: string; orderNumber: string }>;
}) {
  // The layout's gate does not cover a page on client navigation — see requireAdmin().
  await requireAdmin();

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

      <header className="mb-6 lg:mb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-heading text-[26px] font-normal leading-tight text-ground lg:text-[32px]">
            {order.orderNumber}
          </h1>
          <AdminOrderStatus status={order.status} />
          <span
            className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] ${
              order.paymentStatus === "PAID"
                ? "border-success/40 text-success"
                : order.paymentStatus === "FAILED"
                  ? "border-danger/40 text-danger"
                  : "border-ground-border text-ground-muted"
            }`}
          >
            {order.paymentMethod === "CARD" ? "Card" : "Cash"} · {label(order.paymentStatus)}
          </span>
        </div>
        <p className="mt-2 text-[13px] text-ground-muted">
          {order.channel === "OFFLINE" ? "In store" : "Online"} · placed {stamp(order.placedAt)} ·{" "}
          <bdi className="text-ground">{order.customerName}</bdi>
        </p>
      </header>

      {/*
        Actions first on a phone and in the right column on desktop, kept in
        view while the lines scroll: changing an order's state is what this
        screen is opened for. (prompts/admin-redesign-stage-6.md)
      */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
        <aside className="space-y-5 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-[calc(var(--chrome-h)+1.5rem)]">
          <div className="rounded-lg border border-ground-border bg-stone p-5">
            <OrderStatusControl
              orderId={order.id}
              status={order.status}
              paymentStatus={order.paymentStatus}
              paymentMethod={order.paymentMethod}
            />
          </div>

          <div className="rounded-lg border border-ground-border bg-stone p-5">
            <dl>
              <Detail term="Customer"><bdi>{order.customerName}</bdi></Detail>
              {order.customerEmail ? (
                <Detail term="Email">{order.customerEmail}</Detail>
              ) : null}
              {order.customerPhone ? (
                <Detail term="Phone">{order.customerPhone}</Detail>
              ) : null}
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

        </aside>

        <div className="space-y-5 lg:col-start-1 lg:row-start-1">
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

          <dl className="ms-auto max-w-sm rounded-lg border border-ground-border bg-stone p-5 text-[13px]">
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
              <dt className="text-[13px] font-semibold text-ground">Total</dt>
              <dd className="font-heading text-[18px] text-ground-accent">
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

      </div>
    </>
  );
}
