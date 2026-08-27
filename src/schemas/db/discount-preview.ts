/**
 * The shape `resolve_discount()` answers with.
 *
 * Parsed rather than asserted, like every other row in this folder — and here
 * the discipline earns more than usual: this value decides what a customer is
 * told they will save, and an unparsed `any` from an RPC is the one place a
 * malformed reply could become a number on the page.
 *
 * A refusal this build does not recognise degrades to `UNKNOWN` carrying the
 * English sentence, rather than being dropped. The customer is always told
 * something true; at worst it is told in English on the Arabic tree.
 */

import { z } from "zod";

import type { DiscountPreview } from "@/src/types/discount";

const refusalCodeSchema = z.enum([
  "NO_CODE",
  "NOT_RECOGNISED",
  "INACTIVE",
  "NOT_STARTED",
  "EXPIRED",
  "BELOW_MINIMUM",
  "NOT_GRANTED",
  "ALREADY_USED",
  "FULLY_REDEEMED",
  "CUSTOMER_LIMIT",
  "NOTHING_ELIGIBLE",
  "ZERO_AMOUNT",
]);

const previewSchema = z.union([
  z.object({
    ok: z.literal(true),
    code: z.string(),
    amountInCents: z.coerce.number().int().positive(),
  }),
  z.object({
    ok: z.literal(false),
    // A plain string here, narrowed below. Parsing it as the enum would make a
    // reason code from a newer migration invalidate the whole reply and lose
    // the sentence with it — the one thing that is always safe to show.
    reasonCode: z.string().default(""),
    reason: z.string().default(""),
  }),
]);

export function toDiscountPreview(value: unknown): DiscountPreview | null {
  const parsed = previewSchema.safeParse(value);
  if (!parsed.success) return null;

  if (parsed.data.ok) {
    return {
      ok: true,
      code: parsed.data.code,
      amountInCents: parsed.data.amountInCents,
    };
  }

  const named = refusalCodeSchema.safeParse(parsed.data.reasonCode);

  return {
    ok: false,
    reasonCode: named.success ? named.data : "UNKNOWN",
    reason: parsed.data.reason,
  };
}
