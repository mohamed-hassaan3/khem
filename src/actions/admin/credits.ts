"use server";

/**
 * Credit writes — the one an administrator may make.
 *
 * ## Why there is only one
 *
 * Issuing, activating, expiring and cancelling a credit are consequences of
 * order events: a payment clears, a parcel is delivered, sixty days pass, a
 * refund is made. Each happens inside the SQL function that performs the event
 * it follows, in the same transaction. Exposing any of them as a button would
 * create a second way for a credit to exist, and the ledger would stop being a
 * record of what actually happened.
 *
 * `adjustCredit` is the exception, and it is shaped as one: it writes a new
 * ADJUSTED row, never edits an existing one, requires a reason, and records the
 * administrator who made it.
 *
 * ## Trust model, restated
 *
 * A Server Action is a public HTTP endpoint. `requireAdmin()` is the first
 * statement, and the amount is parsed by `schemas/credits.ts` before it reaches
 * the function — which then refuses anything that would take the balance below
 * zero, under a row lock.
 *
 * ## Logging
 *
 * Actor and credit id. **Never** the amount or the customer: a credit row names
 * a person and a sum of money, which is why `0026` grants the public roles
 * nothing, and copying either into a log defeats that.
 */

import { requireAdmin } from "@/src/lib/admin/auth";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { AdminActionResult } from "@/src/schemas/admin";
import { adjustCreditSchema } from "@/src/schemas/credits";

import { UNCONFIGURED, fieldErrorsFrom, type PostgresErrorLike } from "./shared";

export async function adjustCredit(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = adjustCreditSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase.rpc("adjust_credit", {
    credit_id: parsed.data.creditId,
    amount: parsed.data.amountInCents,
    note: parsed.data.note,
    // The verified admin email, taken from the session — never from the form.
    actor: actor.email,
  });

  if (error) {
    console.error(`[admin] adjustCredit failed: ${error.message}`);

    const failure = error as PostgresErrorLike;
    const message = failure.message ?? "";

    // Both are raised by `adjust_credit()` with sentences written for the desk,
    // so they are passed through rather than replaced with a generic one.
    if (message.includes("below zero") || message.includes("records nothing")) {
      return {
        ok: false,
        message: "Some fields need attention.",
        fieldErrors: { amountInCents: message },
      };
    }

    if (message.includes("No credit with the id")) {
      return { ok: false, message: "That credit no longer exists." };
    }

    return {
      ok: false,
      message: "The database refused that adjustment. The details are in the server log.",
    };
  }

  console.info(`[admin] ${actor.email} adjusted credit ${parsed.data.creditId}`);

  return {
    ok: true,
    slug: parsed.data.creditId,
    message: "Adjustment recorded.",
  };
}
