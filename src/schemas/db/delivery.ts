/**
 * The delivery terms, as the database carries them.
 *
 * Same contract as the other `schemas/db/*` modules: an explicit column list, a
 * row schema that is parsed rather than asserted, and a `to…` function returning
 * `null` on a shape it does not recognise. The caller decides what a `null`
 * means — for these two figures it means "quote the house defaults", which is a
 * more useful answer than an exception thrown into a cart page.
 */

import { z } from "zod";

/** The channels an order can arrive through — `public."OrderChannel"`. */
export const DELIVERY_CHANNELS = ["ONLINE", "OFFLINE"] as const;

export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

export const DELIVERY_SETTING_COLUMNS =
  'channel, "feeInCents", "freeThresholdInCents"';

/**
 * What delivery costs on one channel.
 *
 * Both figures are in piastres, the same minor unit `"Product"."priceInCents"`
 * uses, so nothing between the row and the total ever multiplies by 100.
 */
export interface DeliveryTerms {
  /** Flat fee below the minimum. Zero means delivery is always complimentary. */
  feeInCents: number;
  /** The minimum order for complimentary delivery. Zero means every order. */
  freeThresholdInCents: number;
}

export const deliverySettingRowSchema = z.object({
  channel: z.enum(DELIVERY_CHANNELS),
  feeInCents: z.coerce.number().int().nonnegative(),
  freeThresholdInCents: z.coerce.number().int().nonnegative(),
});

export type DeliverySetting = z.infer<typeof deliverySettingRowSchema>;

export function toDeliverySetting(row: unknown): DeliverySetting | null {
  const parsed = deliverySettingRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}
