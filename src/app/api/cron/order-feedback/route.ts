/**
 * Ask, a day later, how it wears.
 *
 * Twenty-four hours after an order reaches DELIVERED, the customer receives one
 * letter listing what they bought, each item linking to that product's comment
 * area. Nothing about an order changes at that mark — which is exactly why this
 * needs a clock rather than a status trigger like every other order email.
 *
 * ## The schedule, and what "24 hours" honestly means
 *
 * `vercel.json` runs this **once a day**, because the Hobby plan permits no
 * more than that — the same constraint `sweep-unpaid-orders` documents, and the
 * same one that would refuse the whole deployment if an hourly expression were
 * written here. So the letter goes out on the first scheduled pass at or after
 * the twenty-four hour mark: in practice between one and two days after
 * delivery, which is well inside the window where the question is still worth
 * asking. On Pro, tighten the schedule to something hourly and the wording
 * becomes literally true; nothing else has to change.
 *
 * ## Claim, then send
 *
 * `mark_feedback_requested()` stamps `"Order"."feedbackRequestedAt"` **before**
 * the mail is handed to Resend, and only the caller whose update matched gets
 * to send. A letter lost to a provider outage costs one missed conversation; a
 * letter sent twice about the same parcel is the house looking careless, and of
 * those two the second is the one the customer sees.
 *
 * ## Authentication
 *
 * Identical to the sweeper: a bearer token compared in constant time, checked
 * before any database call. Vercel sends `CRON_SECRET` automatically on
 * scheduled invocations. Without the guard this would be a public "mail every
 * recent customer" button.
 */

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { notifyCustomerOfFeedbackRequest } from "@/src/lib/email/send-order-mail";
import {
  getOrderForFeedback,
  listOrdersAwaitingFeedback,
  markFeedbackRequested,
} from "@/src/services/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How long after delivery the question stops being intrusive and starts being welcome. */
const DELAY_HOURS = 24;

/**
 * A ceiling on one run.
 *
 * Not a throttle on the house's ambitions — it is a bound on how long a single
 * invocation can take, since each order is one Resend call. Anything above the
 * ceiling simply waits for tomorrow's pass, and the `feedbackRequestedAt` stamp
 * means it is still owed exactly one letter when it gets there.
 */
const MAX_PER_RUN = 40;

/** Constant-time comparison. See `sweep-unpaid-orders` for the reasoning. */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    // Fail closed. An unguarded endpoint here mails customers on demand.
    console.error("[cron] CRON_SECRET is not set; feedback run refused.");
    return NextResponse.json({ error: "unconfigured" }, { status: 500 });
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!tokenMatches(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ids = await listOrdersAwaitingFeedback(DELAY_HOURS, MAX_PER_RUN);

  let sent = 0;

  for (const id of ids) {
    // Sequential rather than `Promise.all`: a provider rate limit that drops
    // one of forty parallel sends should drop the fortieth, not an arbitrary
    // one — and these letters are never urgent.
    const claimed = await markFeedbackRequested(id);
    if (!claimed) continue;

    const order = await getOrderForFeedback(id);
    if (!order) continue;

    await notifyCustomerOfFeedbackRequest(order);
    sent += 1;
  }

  // Counts only. Who was written to is not this log's business — the same rule
  // `src/lib/email/send-order-mail.ts` states for its failure lines.
  if (sent > 0) console.info(`[cron] Sent ${sent} feedback letter(s).`);

  return NextResponse.json({ sent });
}
