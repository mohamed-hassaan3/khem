"use server";

/**
 * Leaving the Inner Circle.
 *
 * ## Why this is an action and not the page's own render
 *
 * The obvious version reads `?token=` in the server component and removes the
 * address there. That makes a **GET request perform the removal**, and GETs to
 * a link in an email are made by things that are not the recipient: corporate
 * link scanners, spam filters that fetch every URL to check it, mail clients
 * that prefetch. Any one of them would silently unsubscribe somebody who never
 * clicked anything, and the person would only find out by noticing the letters
 * had stopped.
 *
 * So the page confirms, and this — reached by a button press — is what writes.
 *
 * ## The token is the authorisation
 *
 * There is no session here and there must not be one: the whole point is that
 * somebody reading an email can leave without signing in, and most subscribers
 * have no account at all. The row's own random token is the credential, which
 * is why `supabase/sql/0025_newsletter.sql` generates one per row rather than
 * addressing the row by its id.
 *
 * ## Privacy
 *
 * Nothing here logs the address. The outcome carries it back to the *page* so
 * the reader can see which address was removed — that is the one place it
 * belongs, and it is a value they already have.
 */

import { unsubscribeByToken } from "@/src/services/newsletter";
import type { UnsubscribeOutcome } from "@/src/types/newsletter";

/** Refused before a query is made. Nothing legitimate is this long. */
const MAX_TOKEN_LENGTH = 200;

const NOT_FOUND: UnsubscribeOutcome = {
  found: false,
  alreadyOff: false,
  email: null,
};

export async function confirmUnsubscribe(
  token: unknown,
): Promise<UnsubscribeOutcome> {
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > MAX_TOKEN_LENGTH
  ) {
    return NOT_FOUND;
  }

  // A token that matches nothing and a token that was tampered with get the
  // same answer, which tells a prober nothing about which addresses exist.
  return unsubscribeByToken(token);
}
