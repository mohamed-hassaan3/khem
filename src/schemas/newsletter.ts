/**
 * Inner Circle signup validation. See `contact.ts` for why errors are codes.
 */

import { z } from "zod";

export const newsletterSchema = z.object({
  email: z.email("invalidEmail").max(254, "invalidEmail"),
  /** Honeypot — see `contact.ts`. */
  company: z.string().max(0).optional(),
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;
