/**
 * Row schema for one customer's notification feed.
 *
 * Parsed rather than asserted, like every neighbour. A malformed row is dropped
 * and the rest of the panel still renders — the alternative, on a screen whose
 * whole job is to reassure somebody about an order, is a blank page.
 */

import { z } from "zod";

import type { CustomerNotification } from "@/src/types/notification";

import { parseList } from "./catalog";

const rowSchema = z.object({
  kind: z.enum(["ORDER_STATUS", "CREDIT_EARNED", "VOUCHER_GRANTED"]),
  entityId: z.string(),
  label: z.string(),
  detail: z.string().nullable().default(null),
  amountInCents: z.coerce.number().nullable().default(null),
  occurredAt: z.string(),
  isRead: z.boolean().default(false),
});

export function toCustomerNotification(row: unknown): CustomerNotification | null {
  const parsed = rowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export { parseList };
