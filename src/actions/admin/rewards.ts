"use server";

/**
 * The one points write an administrator may make.
 *
 * ## Why there is only one
 *
 * `actions/admin/credits.ts`'s reasoning, applied to points. Earning, redeeming,
 * reversing and expiring are **consequences of events** — a payment clears, an
 * order is refunded, a review is published, a window closes — and each happens
 * inside the SQL function that performs the event it follows, in the same
 * transaction. Exposing any of them as a button would create a second way for
 * points to exist, and the ledger would stop being a record of what happened.
 *
 * `adjustPoints` is the deliberate exception, and it is shaped as one: it writes
 * a new row, never edits an existing one, requires a reason, and records the
 * administrator who made it.
 *
 * ## Logging
 *
 * Actor and customer id. **Never** the amount or the customer's name: these rows
 * name a person and something worth money, which is why `0059` grants the public
 * roles nothing, and copying either into a log defeats that.
 */

import { requireAdmin } from "@/src/lib/admin/auth";
import { revalidateBenefits } from "@/src/lib/admin/revalidate";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { AdminActionResult } from "@/src/schemas/admin";
import { adjustPointsSchema } from "@/src/schemas/rewards";

import { UNCONFIGURED, fieldErrorsFrom, type PostgresErrorLike } from "./shared";

export async function adjustPoints(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = adjustPointsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase.rpc("adjust_points", {
    clerk_id: parsed.data.clerkUserId,
    amount: parsed.data.points,
    note: parsed.data.note,
    // The verified admin email, taken from the session — never from the form.
    actor: actor.email,
  });

  if (error) {
    console.error(`[admin] adjustPoints failed: ${error.message}`);

    const failure = error as PostgresErrorLike;
    const message = failure.message ?? "";

    // Both are raised by `adjust_points()` with sentences written for the desk,
    // so they are passed through rather than replaced with a generic one.
    if (message.includes("below zero") || message.includes("records nothing")) {
      return {
        ok: false,
        message: "Some fields need attention.",
        fieldErrors: { points: message },
      };
    }

    if (message.includes("needs a customer")) {
      return { ok: false, message: "That customer no longer exists." };
    }

    return {
      ok: false,
      message: "The database refused that adjustment. The details are in the server log.",
    };
  }

  revalidateBenefits();
  console.info(`[admin] ${actor.email} adjusted points for ${parsed.data.clerkUserId}`);

  return {
    ok: true,
    slug: parsed.data.clerkUserId,
    message: "Adjustment recorded.",
  };
}
