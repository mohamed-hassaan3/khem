/**
 * Row schemas for the desk's notification feed.
 *
 * Same rules as its neighbours: rows parsed rather than asserted, one malformed
 * row dropped rather than a blanked panel. The feed is a read of four tables
 * unioned in SQL, so a shape surprise here is a query change somewhere else —
 * and dropping the row is how the bell survives one.
 */

import { z } from "zod";

import type { AdminNotification, LowStockItem } from "@/src/types/notification";

import { parseList } from "./catalog";

const notificationRowSchema = z.object({
  kind: z.enum(["ORDER", "CUSTOMER", "VOUCHER", "CREDIT"]),
  entityId: z.string(),
  label: z.string(),
  detail: z.string().nullable().default(null),
  amountInCents: z.coerce.number().nullable().default(null),
  occurredAt: z.string(),
  isRead: z.boolean().default(false),
});

export function toAdminNotification(row: unknown): AdminNotification | null {
  const parsed = notificationRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

const lowStockRowSchema = z.object({
  slug: z.string(),
  name: z.string(),
  inventory: z.coerce.number(),
});

export function toLowStockItem(row: unknown): LowStockItem | null {
  const parsed = lowStockRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export { parseList };
