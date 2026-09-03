"use client";

/**
 * Moving an order along, and recording that it has been paid.
 *
 * Two controls rather than one because the two states are independent: an
 * order can be paid and still sitting on the bench. What they are *not* is
 * unrelated — delivery waits for payment, and both groups feed one confirmation
 * panel that says so.
 *
 * Both groups render **every** value they can hold, and flag the current one.
 * A group whose membership changed with the selection meant an editor watched
 * options vanish as they worked and could not see, at a glance, where in the
 * sequence an order sat. What `schemas/orders.ts` allows now decides which
 * buttons are *disabled*, not which exist. The server re-checks anyway against
 * the row as it is *now*, because this page may have been open while somebody
 * else cancelled the order — a button forced back to life in devtools is
 * refused there, and then again in the database.
 *
 * ## Why every change asks twice
 *
 * Only cancelling and refunding used to. But a status change here sends the
 * customer an email, moves stock, and starts or ends a Discovery Credit's
 * sixty-day window — consequences the desk cannot take back, reached by a
 * single click on a row of near-identical buttons. So each change now arms a
 * panel that names what is about to happen, in one sentence, before it happens.
 * Two clicks, and the second one is informed.
 *
 * ## The panel takes its colours from the ground it is on
 *
 * It first shipped as `bg-surface/60` with `text-ground-muted`, which is the
 * exact failure `globals.css` warns about: `--color-surface` is the dark
 * obsidian, `--color-ground-muted` on the admin's ivory ground is dark ink, and
 * the two together are unreadable. A panel does not get to choose a background
 * independently of the type colour it inherits — so this one sits on
 * `bg-ground-bg` and states its type in `text-ground`, and is correct on
 * whichever ground the screen turns out to be.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { updateOrderStatus, updatePaymentStatus } from "@/src/actions/admin/orders";
import {
  allowedTransitions,
  canChangePayment,
  canTransition,
  orderStatusValues,
  paymentStatusValues,
  requiresPayment,
} from "@/src/schemas/orders";
import type { OrderStatus } from "@/src/types/account";
import type { PaymentMethod, PaymentStatus } from "@/src/types/order";

/** What the desk is about to confirm. One at a time, across both groups. */
type Armed =
  | { kind: "status"; to: OrderStatus }
  | { kind: "payment"; to: PaymentStatus };

function label(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/**
 * What this status change sets in motion, in the desk's words.
 *
 * Written as consequences rather than mechanics: "the customer is emailed", not
 * "notifyCustomerOfOrder is called". The reader is deciding whether to click,
 * and what they need is what the customer will experience.
 */
function statusConsequences(to: OrderStatus): readonly string[] {
  switch (to) {
    case "DELIVERED":
      return [
        "This states, on the record, that the customer received their order.",
        "The customer is emailed a delivery confirmation.",
        "Any Discovery Credit earned on this order becomes spendable, and its sixty-day window starts now.",
      ];
    case "SHIPPED":
      return [
        "The customer is emailed that their order is on its way, with the tracking code saved on this page.",
      ];
    case "CANCELLED":
      return [
        "Every unit on this order goes back into stock.",
        "The customer is emailed that the order was cancelled.",
        "Any unspent Discovery Credit this order earned is cancelled.",
        "This cannot be undone — a cancelled order cannot be reopened.",
      ];
    case "REFUNDED":
      return [
        "Every unit on this order goes back into stock.",
        "The customer is emailed that the order was refunded.",
        "Any unspent Discovery Credit this order earned is cancelled, and a credit spent on it is returned.",
        "This cannot be undone — a refunded order cannot be reopened.",
      ];
    case "PROCESSING":
      return ["The customer is not emailed about this change."];
  }
}

function paymentConsequences(to: PaymentStatus): readonly string[] {
  switch (to) {
    case "PAID":
      return [
        "This records that the money has been received.",
        "Any Discovery Set on this order earns its credit now — immediately spendable if the order has already been delivered.",
        "It cannot be undone. A payment recorded here is reversed by refunding it, not by changing it back.",
      ];
    case "REFUNDED":
      return [
        "Any unspent Discovery Credit this order earned is cancelled, and a credit spent on it is returned.",
        "Stock is not returned by this — mark the order refunded as well if the goods came back.",
      ];
    case "FAILED":
    case "UNPAID":
      return ["No money and no credit are involved; this only corrects the record."];
  }
}

export default function OrderStatusControl({
  orderId,
  status,
  paymentStatus,
  paymentMethod,
}: {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [armed, setArmed] = useState<Armed | null>(null);
  const [error, setError] = useState<string | null>(null);

  const next = allowedTransitions(status);
  const paid = paymentStatus === "PAID";

  // Escape disarms, so a panel opened by mistake costs one key rather than a
  // hunt for the cancel button.
  useEffect(() => {
    if (!armed) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setArmed(null);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed]);

  function commit() {
    if (!armed) return;

    const target = armed;
    setArmed(null);
    setError(null);

    startTransition(async () => {
      const outcome =
        target.kind === "status"
          ? await updateOrderStatus({ orderId, status: target.to })
          : await updatePaymentStatus({ orderId, paymentStatus: target.to });

      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }

      router.refresh();
    });
  }

  const consequences = armed
    ? armed.kind === "status"
      ? statusConsequences(armed.to)
      : paymentConsequences(armed.to)
    : [];

  const heading = armed
    ? armed.kind === "status"
      ? `Fulfilment: ${label(status)} → ${label(armed.to)}`
      : `Payment: ${label(paymentStatus)} → ${label(armed.to)}`
    : "";

  const buttonBase =
    "rounded-none border px-5 py-2.5 font-heading text-[9px] uppercase tracking-[0.2em] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none disabled:pointer-events-none";

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
          Fulfilment
        </p>

        {next.length === 0 ? (
          <p className="mb-4 text-[12px] leading-relaxed text-ground-muted">
            This order is closed. Its units were returned to stock and it cannot
            be reopened — record a new order instead.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {orderStatusValues.map((to) => {
            const active = to === status;
            const unpaidBlock = requiresPayment(to) && !paid;
            const reachable = canTransition(status, to) && !unpaidBlock;
            const isArmed = armed?.kind === "status" && armed.to === to;

            return (
              <button
                key={to}
                type="button"
                disabled={isPending || active || !reachable}
                aria-pressed={active}
                onClick={() => setArmed({ kind: "status", to })}
                title={
                  active
                    ? "Where this order is now."
                    : unpaidBlock
                      ? "This order has not been paid. Record the payment before confirming delivery."
                      : reachable
                        ? undefined
                        : `An order that is ${status.toLowerCase()} cannot become ${to.toLowerCase()}.`
                }
                className={`${buttonBase} ${
                  active
                    ? "border-gold/50 bg-gold/10 text-ground-accent"
                    : isArmed
                      ? "border-gold bg-gold/10 text-ground-accent"
                      : !reachable
                        ? "border-ground-border/50 text-ground-subtle"
                        : "border-ground-border text-ground-muted hover:border-gold/40 hover:text-ground-accent"
                }`}
              >
                {label(to)}
              </button>
            );
          })}
        </div>

        {!paid && canTransition(status, "DELIVERED") ? (
          <p className="mt-4 text-[11px] leading-relaxed text-ground-muted">
            Delivery is unavailable until this order is paid.{" "}
            {paymentMethod === "CARD"
              ? "A card order is marked paid automatically once the payment clears."
              : "Record the cash payment below first."}
          </p>
        ) : null}
      </div>

      <div>
        <p className="mb-4 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
          Payment
        </p>

        <div className="flex flex-wrap gap-3">
          {paymentStatusValues.map((value) => {
            const active = value === paymentStatus;
            const reachable = canChangePayment(paymentStatus, value);
            const isArmed = armed?.kind === "payment" && armed.to === value;

            return (
              <button
                key={value}
                type="button"
                disabled={isPending || active || !reachable}
                onClick={() => setArmed({ kind: "payment", to: value })}
                aria-pressed={active}
                title={
                  active
                    ? "Where this payment is now."
                    : reachable
                      ? undefined
                      : paymentStatus === "PAID"
                        ? "This order has been paid. Refund it to reverse the payment."
                        : `A payment that is ${paymentStatus.toLowerCase()} cannot become ${value.toLowerCase()}.`
                }
                className={`${buttonBase} ${
                  active
                    ? "border-gold/50 bg-gold/10 text-ground-accent"
                    : isArmed
                      ? "border-gold bg-gold/10 text-ground-accent"
                      : !reachable
                        ? "border-ground-border/50 text-ground-subtle"
                        : "border-ground-border text-ground-muted hover:border-gold/40 hover:text-ground-accent"
                }`}
              >
                {label(value)}
              </button>
            );
          })}
        </div>

        {paymentMethod === "CARD" && paymentStatus !== "PAID" ? (
          <p className="mt-4 text-[11px] leading-relaxed text-ground-muted">
            This is a card order. It is marked paid automatically when the
            payment clears — record it by hand only if the money arrived some
            other way.
          </p>
        ) : null}
      </div>

      {armed ? (
        <div
          role="alertdialog"
          aria-label={heading}
          className="khem-rise border border-gold/40 bg-ground-bg px-5 py-4"
        >
          <p className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-accent">
            {heading}
          </p>

          <ul className="mt-3 space-y-1.5">
            {consequences.map((line) => (
              <li key={line} className="text-[12px] leading-relaxed text-ground">
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              autoFocus
              disabled={isPending}
              onClick={commit}
              className={`${buttonBase} border-gold text-ground-accent hover:bg-gold/10`}
            >
              Confirm
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => setArmed(null)}
              className={`${buttonBase} border-transparent text-ground-muted hover:border-ground-border hover:text-ground-accent`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}
