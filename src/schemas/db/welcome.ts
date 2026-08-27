/**
 * The shape `claim_welcome()` answers with.
 *
 * Parsed, never asserted — the same rule as every other row schema here, and it
 * matters especially for this one: a malformed reply read optimistically would
 * either send a letter nobody claimed the right to send, or send one naming a
 * voucher code that is not there.
 *
 * A reply that cannot be parsed at all becomes `null`, which the service turns
 * into "unclaimed" — no letter. Failing closed is the correct direction: an
 * unsent welcome is recoverable on the next retry, a duplicate is not.
 */

import { z } from "zod";

import type { WelcomeClaim } from "@/src/types/welcome";

const claimSchema = z.union([
  z.object({
    claimed: z.literal(true),
    email: z.string().min(3),
    firstName: z.string().nullable().default(null),
    code: z.string().nullable().default(null),
    expiresAt: z.string().nullable().default(null),
  }),
  z.object({ claimed: z.literal(false) }),
]);

export function toWelcomeClaim(value: unknown): WelcomeClaim | null {
  const parsed = claimSchema.safeParse(value);
  if (!parsed.success) return null;

  if (!parsed.data.claimed) return { claimed: false };

  return {
    claimed: true,
    email: parsed.data.email,
    firstName: parsed.data.firstName,
    // A code with no grant behind it cannot occur — the function writes both or
    // neither — but the pairing is asserted here anyway, because a letter
    // naming a code with no expiry it can state is a letter half-composed.
    code: parsed.data.code,
    expiresAt: parsed.data.code === null ? null : parsed.data.expiresAt,
  };
}
