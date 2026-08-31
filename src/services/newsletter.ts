import "server-only";

/**
 * The Inner Circle list — writes, and the one read that is not the dashboard's.
 *
 * Split from `src/services/admin/newsletter.ts` on purpose: everything here is
 * reached by a *customer* — the signup form, the Clerk webhook, the unsubscribe
 * link — and none of it sits behind `requireAdmin()`. The authorisation is
 * different in each case and worth naming:
 *
 *  - subscribing authorises nothing; anybody may put *their own* address on a
 *    list, and the rate limit in the action is what stops that being abused;
 *  - unsubscribing is authorised by the row's own random token, which is the
 *    only credential a person reading an email is guaranteed to have.
 *
 * All of it runs behind the secret key, because `0025_newsletter.sql` grants
 * the public roles nothing.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  toSubscribeOutcome,
  toUnsubscribeOutcome,
} from "@/src/schemas/db/newsletter";
import type {
  NewsletterSource,
  SubscribeOutcome,
  UnsubscribeOutcome,
} from "@/src/types/newsletter";

export interface SubscribeInput {
  email: string;
  locale: "en" | "ar";
  source: NewsletterSource;
  /** Present when the subscription came from a signed-in account. */
  clerkUserId?: string | null;
}

/**
 * Put an address on the list, or bring it back.
 *
 * Returns null when the write failed, which the caller treats as "not
 * subscribed" rather than pretending otherwise — the whole point of this phase
 * is that the list is now the record, so a failed write must not be reported to
 * somebody as a successful signup.
 *
 * The email is never logged. It is the one field this module exists to protect.
 */
export async function subscribe(
  input: SubscribeInput,
): Promise<SubscribeOutcome | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("subscribe_newsletter", {
    payload: {
      email: input.email,
      locale: input.locale,
      source: input.source,
      clerkUserId: input.clerkUserId ?? null,
    },
  });

  if (error) {
    console.error(`[newsletter] subscribe failed: ${error.message}`);
    return null;
  }

  return toSubscribeOutcome(data);
}

const NOT_FOUND: UnsubscribeOutcome = {
  found: false,
  alreadyOff: false,
  email: null,
};

/**
 * Take an address off the list, by the token in their letter.
 *
 * Idempotent: a second click, or a mail client that fetches the link twice,
 * gets the same answer rather than an error implying it did not work.
 *
 * ## Two kinds of token, one link
 *
 * A subscriber's row has carried its own token since `0025_newsletter.sql`, and
 * every letter sent before campaigns had audiences used it. Since
 * `0036_campaign_audiences.sql` each *send* also carries one, so a customer or a
 * hand-typed address can unsubscribe without ever having been enrolled in the
 * Inner Circle — following that one suppresses the address for every future
 * campaign, and unsubscribes the list row as well when there is one.
 *
 * The two are separate secrets in separate tables, so the order below is not a
 * correctness question: a token matches at most one of them. Subscriber tokens
 * are tried first because links sent before this change carry those, and a
 * letter that has already gone must keep working forever.
 */
export async function unsubscribeByToken(
  token: string,
): Promise<UnsubscribeOutcome> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NOT_FOUND;

  const { data, error } = await supabase.rpc("unsubscribe_newsletter", { token });

  if (error) {
    console.error(`[newsletter] unsubscribe failed: ${error.message}`);
    return NOT_FOUND;
  }

  const outcome = toUnsubscribeOutcome(data);
  if (outcome.found) return outcome;

  const { data: bySend, error: sendError } = await supabase.rpc(
    "unsubscribe_by_campaign_token",
    { token },
  );

  if (sendError) {
    console.error(`[newsletter] campaign unsubscribe failed: ${sendError.message}`);
    return NOT_FOUND;
  }

  return toUnsubscribeOutcome(bySend);
}

/**
 * Withdraw an account's consent, keyed by Clerk id.
 *
 * Used by the webhook when somebody clears the marketing box on their profile.
 * Unlike {@link unsubscribeByToken} this is not addressed by a secret, because
 * it is not reached by a link — the authority is Clerk's signature on the
 * event, checked before this is called.
 *
 * Silent when the address was never on the list: there is nothing to withdraw
 * and nothing to report.
 */
export async function unsubscribeByClerkUser(clerkUserId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { error } = await supabase
    .from("NewsletterSubscriber")
    .update({
      status: "UNSUBSCRIBED",
      unsubscribedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .eq("clerkUserId", clerkUserId)
    .eq("status", "SUBSCRIBED");

  if (error) {
    console.error(`[newsletter] unsubscribeByClerkUser failed: ${error.message}`);
  }
}
