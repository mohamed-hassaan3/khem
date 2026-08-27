/**
 * Credit write validation.
 *
 * There is exactly one write an administrator may make, and that is the point:
 * issuance, activation, expiry and cancellation are **consequences of order
 * events**, not buttons. A dashboard that could mint a credit would be a second
 * way for one to exist, and the ledger would no longer describe what happened.
 *
 * `adjust_credit()` is the deliberate exception — the lever for what a policy
 * cannot anticipate. It writes a new row and records who.
 */

import { z } from "zod";

/** A tenth of a piastre would be meaningless; a million-pound adjustment is a typo. */
const MAX_ADJUSTMENT = 1_000_000_00;

export const adjustCreditSchema = z.object({
  creditId: z.string().trim().min(1, "Which credit?"),
  /**
   * Signed, in piastres. Positive gives, negative takes away.
   *
   * Zero is refused by the database too — an adjustment of nothing records
   * nothing and would leave a row implying somebody acted.
   */
  amountInCents: z.coerce
    .number({ error: "Enter an amount." })
    .int("Whole piastres only.")
    .refine((value) => value !== 0, "An adjustment of zero records nothing.")
    .refine(
      (value) => Math.abs(value) <= MAX_ADJUSTMENT,
      "That is larger than any credit the house issues.",
    ),
  /** Required, unlike most notes: an unexplained adjustment is the thing an audit cannot answer. */
  note: z
    .string()
    .trim()
    .min(3, "Say why — an unexplained adjustment cannot be audited later.")
    .max(500, "That note is too long."),
});
