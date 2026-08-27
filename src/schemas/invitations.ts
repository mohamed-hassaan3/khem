/**
 * What an invitation may say.
 *
 * Two fields, and the smallness is the point: an invitation grants somebody the
 * right to open an account and nothing more. No role, no metadata, no id — a
 * schema that accepted any of those would be one an administrator's compromised
 * session could use to mint something other than a customer.
 *
 * Messages are English sentences rather than dictionary keys, following
 * `src/schemas/orders.ts` and unlike `src/schemas/checkout.ts`: the dashboard is
 * English by construction and has exactly one reader.
 */

import { z } from "zod";

import { LOCALES } from "@/src/lib/i18n/config";

export const inviteCustomerSchema = z.object({
  email: z
    .email("Enter a valid email address.")
    .max(200, "That address is too long."),
  /**
   * Which language to write the invitation in — and, through the invitation's
   * `publicMetadata`, the welcome letter that follows it.
   */
  locale: z.enum(LOCALES, { error: "Choose a language." }),
});

export type InviteCustomerInput = z.input<typeof inviteCustomerSchema>;
