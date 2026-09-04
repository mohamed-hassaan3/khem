"use client";

/**
 * The rail, behind one quiet control.
 *
 * ## What did *not* change
 *
 * `<OrderTracker>` is untouched: it still draws every station the order really
 * reached, with the dates `"OrderStatusEvent"` recorded. Nothing was removed
 * from the card — the rail simply starts closed, so a history of nine orders is
 * nine legible rows rather than nine timelines stacked down the page.
 *
 * The trigger names the current station, which is the whole point of collapsing
 * it: a closed card still answers "where is my order", and opening it is for
 * "and when did that happen".
 *
 * ## Except when the line stopped
 *
 * A cancelled or refunded order opens expanded. That is the case where the
 * customer most needs the detail in front of them, and hiding it behind a
 * control reads as evasion.
 *
 * ## The animation
 *
 * `grid-template-rows: 0fr → 1fr`, so the panel animates to its own height
 * rather than to a guessed `max-height` that clips a three-line rail on a
 * phone. `motion-reduce` drops the transition and keeps the toggle.
 */

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import OrderTracker from "@/src/components/account/OrderTracker";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import type { OrderEvent, OrderStatus } from "@/src/types/account";

/** The two statuses that stop the rail — they open the card. */
const HALTING: readonly OrderStatus[] = ["CANCELLED", "REFUNDED"];

export interface TrackerDisclosureProps {
  status: OrderStatus;
  events: readonly OrderEvent[];
  locale: Locale;
  dict: Dictionary["account"]["orders"]["tracker"];
}

export default function TrackerDisclosure({
  status,
  events,
  locale,
  dict,
}: TrackerDisclosureProps) {
  const halted = HALTING.includes(status);
  const [open, setOpen] = useState(halted);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center justify-between gap-4 bg-transparent p-0 text-start font-heading text-[10px] uppercase tracking-[0.16em] text-ground-muted transition-colors duration-300 ease-luxury-bezier hover:text-ground-accent"
      >
        <span>{open ? dict.hide : dict.trigger}</span>

        <span className="flex items-center gap-2.5">
          {/* The station, on the closed control. Dropped once the rail below
              is showing it, so the same word is never on screen twice. */}
          <span
            className={
              halted ? "text-danger/80" : "text-ground-accent/80"
            }
          >
            {open ? null : dict[status]}
          </span>

          <ChevronDown
            size={14}
            strokeWidth={1.25}
            aria-hidden="true"
            className={`transition-transform duration-300 ease-luxury-bezier ${
              open ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] duration-500 ease-luxury-bezier motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        {/* The clipping row. `min-h-0` is what lets a grid child shrink below
            its content height; without it the panel never closes. */}
        <div className="min-h-0 overflow-hidden">
          <div className="pt-8">
            <OrderTracker
              status={status}
              events={events}
              locale={locale}
              dict={dict}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
