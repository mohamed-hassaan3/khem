"use client";

/**
 * Moving an order along, and marking it paid.
 *
 * Two controls rather than one because the two states are independent: an
 * order can be delivered and unpaid (a walk-in on account), or paid and still
 * sitting on the bench.
 *
 * Only the transitions `schemas/orders.ts` allows are offered, so the
 * impossible ones are not rendered and then refused — an editor never sees a
 * button that cannot work. The server re-checks anyway against the row as it
 * is *now*, because this page may have been open while somebody else cancelled
 * the order.
 *
 * Cancelling and refunding are armed-then-confirmed, the pattern
 * `StatusToggle` uses: both put units back on the shelf, and that is not a
 * thing to do on a stray click.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateOrderStatus, updatePaymentStatus } from "@/src/actions/admin/orders";
import { allowedTransitions, paymentStatusValues } from "@/src/schemas/orders";
import type { OrderStatus } from "@/src/types/account";
import type { PaymentStatus } from "@/src/types/order";

/** Statuses that return stock, and therefore ask twice. */
const RESTOCKING: readonly OrderStatus[] = ["CANCELLED", "REFUNDED"];

function label(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export default function OrderStatusControl({
  orderId,
  status,
  paymentStatus,
}: {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [armed, setArmed] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const next = allowedTransitions(status);

  function move(to: OrderStatus) {
    if (RESTOCKING.includes(to) && armed !== to) {
      setArmed(to);
      return;
    }

    setArmed(null);
    setError(null);

    startTransition(async () => {
      const outcome = await updateOrderStatus({ orderId, status: to });
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      router.refresh();
    });
  }

  function pay(to: PaymentStatus) {
    setError(null);

    startTransition(async () => {
      const outcome = await updatePaymentStatus({ orderId, paymentStatus: to });
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-heading text-[9px] uppercase tracking-[0.2em] text-ivory/25">
          Fulfilment
        </p>

        {next.length === 0 ? (
          <p className="text-[12px] leading-relaxed text-ivory/30">
            This order is closed. Its units were returned to stock and it cannot
            be reopened — record a new order instead.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {next.map((to) => {
              const restocks = RESTOCKING.includes(to);
              const isArmed = armed === to;

              return (
                <button
                  key={to}
                  type="button"
                  disabled={isPending}
                  onClick={() => move(to)}
                  onBlur={() => setArmed(null)}
                  className={`rounded-none border px-5 py-2.5 font-heading text-[9px] uppercase tracking-[0.2em] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none disabled:opacity-40 ${
                    isArmed
                      ? "border-danger bg-danger/10 text-danger"
                      : restocks
                        ? "border-border text-ivory/40 hover:border-danger/50 hover:text-danger"
                        : "border-border text-ivory/45 hover:border-gold/40 hover:text-gold"
                  }`}
                >
                  {isArmed ? `Confirm — restocks` : label(to)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="mb-4 font-heading text-[9px] uppercase tracking-[0.2em] text-ivory/25">
          Payment
        </p>

        <div className="flex flex-wrap gap-3">
          {paymentStatusValues.map((value) => {
            const active = value === paymentStatus;

            return (
              <button
                key={value}
                type="button"
                disabled={isPending || active}
                onClick={() => pay(value)}
                aria-pressed={active}
                className={`rounded-none border px-5 py-2.5 font-heading text-[9px] uppercase tracking-[0.2em] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none disabled:pointer-events-none ${
                  active
                    ? "border-gold/50 bg-gold/10 text-gold"
                    : "border-border text-ivory/40 hover:border-gold/40 hover:text-gold"
                }`}
              >
                {label(value)}
              </button>
            );
          })}
        </div>
      </div>

      {error ? <p className="text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}
