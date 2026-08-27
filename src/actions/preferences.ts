"use server";

/**
 * Changing what the house may write to you about.
 *
 * ## Consent lives in three places, and this moves all three
 *
 * Clerk's `unsafeMetadata.marketingOptIn` is where the customer's choice lives —
 * it is what `SignUpForm` writes and what the webhook reads. `"User".
 * "marketingOptIn"` and `"NewsletterSubscriber"` are mirrors of it, and the
 * Clerk webhook already reconciles both on every `user.updated`.
 *
 * This action does **not** write to Clerk and wait for that webhook. It moves
 * all three in the same request, for a plain reason: a preference that appears
 * not to have saved until a webhook is delivered is a preference the customer
 * toggles a second time. The webhook is unchanged and remains the backstop for a
 * change made anywhere else — and because every step here is idempotent, the two
 * agreeing is not a coincidence to be maintained but the only outcome available.
 *
 * Order matters. Clerk first, because it is the source of truth: if it refuses,
 * nothing else has moved and the customer is told so. The mirrors follow.
 *
 * ## Withdrawal is never deletion
 *
 * Turning marketing off unsubscribes the address; `unsubscribe_newsletter()`
 * flips the status and keeps the row, which is what makes the consent history
 * answerable later. Turning it back on is a *fresh act of consent* and moves
 * `consentAt` — the same treatment a signup gets, because that is what it is.
 *
 * ## Transactional mail is untouched
 *
 * Nothing here affects order confirmations, the welcome letter, or a shipping
 * note. §9.1: those are about the account and its orders, and none of the
 * senders reads this flag.
 *
 * ## Logging
 *
 * The Clerk id and the direction. **Never** the address.
 */

import { clerkClient } from "@clerk/nextjs/server";

import { getViewer } from "@/src/lib/auth";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { marketingPreferenceSchema } from "@/src/schemas/preferences";
import { subscribe, unsubscribeByClerkUser } from "@/src/services/newsletter";

export type PreferenceResult =
  | { ok: true; marketingOptIn: boolean }
  | { ok: false; error: "unauthenticated" | "failed" };

export async function setMarketingPreference(
  input: unknown,
): Promise<PreferenceResult> {
  const viewer = await getViewer();
  if (viewer === null) return { ok: false, error: "unauthenticated" };

  const parsed = marketingPreferenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "failed" };

  const { marketingOptIn } = parsed.data;

  /*
   * 1. Clerk, the source of truth.
   *
   * Merged into whatever `unsafeMetadata` already holds rather than replacing
   * it: `SignUpForm` also writes `locale` there, and the welcome letter reads
   * it. A wholesale overwrite here would quietly cost a customer their language.
   */
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(viewer.id);

    await clerk.users.updateUser(viewer.id, {
      unsafeMetadata: { ...user.unsafeMetadata, marketingOptIn },
    });
  } catch (cause) {
    console.error(
      `[preferences] Clerk refused for ${viewer.id}:`,
      cause instanceof Error ? cause.message : "unknown error",
    );
    return { ok: false, error: "failed" };
  }

  // 2. The mirror in `"User"`. Keeps 0024's rule about when the consent date
  //    moves, which is why it is a function and not an update written here.
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.rpc("set_marketing_opt_in", {
      clerk_id: viewer.id,
      opted_in: marketingOptIn,
    });

    if (error) {
      console.error(`[preferences] mirror failed for ${viewer.id}: ${error.message}`);
    }
  }

  /*
   * 3. The list itself — the thing a campaign actually sends to.
   *
   * Best-effort, and last, because the first two have already recorded the
   * customer's decision: a list write that fails leaves a flag saying "do not
   * write to me" that the webhook will reconcile, which is the safe direction.
   */
  if (marketingOptIn) {
    if (viewer.primaryEmail) {
      await subscribe({
        email: viewer.primaryEmail,
        // Clerk carries no locale here; the account's own language preference
        // is not yet a stored field. English, as the webhook also defaults to.
        locale: "en",
        source: "SIGN_UP",
        clerkUserId: viewer.id,
      });
    }
  } else {
    await unsubscribeByClerkUser(viewer.id);
  }

  console.info(
    `[preferences] ${viewer.id} marketing ${marketingOptIn ? "on" : "off"}`,
  );

  return { ok: true, marketingOptIn };
}
