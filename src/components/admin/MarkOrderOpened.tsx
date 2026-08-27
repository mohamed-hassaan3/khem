"use client";

/**
 * Claims an order as opened, once, when its screen is actually on a desk.
 *
 * Renders nothing. It exists to answer the order book's one blind spot —
 * whether a human has ever looked at an order — without turning that answer
 * into order state. See `supabase/sql/0023_order_opened.sql`.
 *
 * ## Why an effect and not the server render
 *
 * The obvious version calls the RPC in `admin/orders/[orderNumber]/page.tsx`
 * beside the read. That would be a mutation performed during a GET render: it
 * fires for anything that *fetches* the page rather than anything that shows
 * it — a prefetch, a retried render — and would mark orders opened that nobody
 * ever saw, which is the exact fact this feature is supposed to be honest
 * about. An effect runs only after the page is mounted in front of somebody.
 *
 * ## Why failures are silent
 *
 * The write is telemetry. A person reading an order to answer the phone must
 * not be shown a red toast because a bookkeeping row did not save, and the
 * database already refuses to double-claim, so the worst case of losing this
 * call is that the order keeps its "New" marker until the next visit.
 *
 * The `useRef` latch is the second guard, not the first: React's development
 * strict mode mounts effects twice, and `mark_order_opened()` is idempotent
 * anyway — but a second round trip that can only ever return `false` is still
 * a round trip worth not making.
 */

import { useEffect, useRef, useTransition } from "react";

import { markOrderOpened } from "@/src/actions/admin/orders";

export default function MarkOrderOpened({
  orderId,
  alreadyOpened,
}: {
  orderId: string;
  /** True when the row already carries a stamp — then this does nothing at all. */
  alreadyOpened: boolean;
}) {
  const claimed = useRef(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (alreadyOpened || claimed.current) return;
    claimed.current = true;

    startTransition(() => {
      void markOrderOpened({ orderId }).catch(() => {
        // Swallowed on purpose — see the note above. The order simply stays
        // marked "New" until somebody opens it again.
      });
    });
  }, [alreadyOpened, orderId]);

  return null;
}
