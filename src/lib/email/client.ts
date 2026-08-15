/**
 * Resend client access.
 *
 * Constructed lazily rather than at module load: importing this file must not
 * throw in an environment without `RESEND_API_KEY` (a preview branch, CI, a
 * fresh clone), because a throw at import time takes the whole route down
 * instead of degrading one form.
 *
 * Presence is reported separately so callers can fail *closed* with a clear
 * error code — never fall through to a fake success. See
 * `src/lib/search/semantic.ts` for the same guard shape.
 */

import { Resend } from "resend";

let client: Resend | null = null;

/** True when the server is configured to send mail at all. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * The shared Resend instance, or `null` when unconfigured.
 *
 * Server-only: `RESEND_API_KEY` is not a `NEXT_PUBLIC_*` var, so this module
 * must never be reachable from a Client Component import graph.
 */
export function getEmailClient(): Resend | null {
  if (!isEmailConfigured()) return null;
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}
