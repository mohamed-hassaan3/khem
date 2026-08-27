/**
 * What may be marked read.
 *
 * A list of `(kind, entityId)` pairs and nothing else. There is no amount, no
 * label and no timestamp here because none of those are the caller's to assert —
 * the feed derives all three from the rows the notification is *about*.
 *
 * Capped at the feed's own size: "mark all as read" acts over what the panel is
 * showing, and a request naming ten thousand pairs is not that.
 */

import { z } from "zod";

/**
 * How many events the panel holds, and the cap this schema enforces.
 *
 * Declared here rather than in the service because that module is
 * `server-only`: a schema is shared vocabulary, and one that could not be
 * imported from a client component would be a schema with a hidden runtime
 * dependency. The service imports it from here.
 */
export const NOTIFICATION_LIMIT = 50;

export const markReadSchema = z.object({
  items: z
    .array(
      z.object({
        kind: z.enum(["ORDER", "CUSTOMER", "VOUCHER", "CREDIT"]),
        entityId: z.string().trim().min(1).max(128),
      }),
    )
    .min(1)
    .max(NOTIFICATION_LIMIT),
});

export type MarkReadInput = z.input<typeof markReadSchema>;
