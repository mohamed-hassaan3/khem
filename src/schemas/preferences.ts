/**
 * What a customer may change about how the house writes to them.
 *
 * **One boolean.** No email, no user id, no token — the account is taken from
 * the session, and a schema that accepted an address would be one that lets a
 * signed-in customer unsubscribe somebody else.
 */

import { z } from "zod";

/** The feed's cap, shared by the mark-read schema below. */
export const CUSTOMER_NOTIFICATION_LIMIT = 50;

export const marketingPreferenceSchema = z.object({
  marketingOptIn: z.boolean(),
});

export const markCustomerReadSchema = z.object({
  items: z
    .array(
      z.object({
        kind: z.enum(["ORDER_STATUS", "CREDIT_EARNED", "VOUCHER_GRANTED"]),
        entityId: z.string().trim().min(1).max(128),
      }),
    )
    .min(1)
    .max(CUSTOMER_NOTIFICATION_LIMIT),
});

export type MarketingPreferenceInput = z.input<typeof marketingPreferenceSchema>;
export type MarkCustomerReadInput = z.input<typeof markCustomerReadSchema>;
