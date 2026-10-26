/**
 * Guest order ownership claims.
 *
 * This is a server-only write through the Supabase secret key. Its callers
 * supply the Clerk primary email and verification state read server-side from
 * a signed Clerk webhook or currentUser(); browser input is never accepted.
 */

import "server-only";

import { getSupabaseAdmin } from "@/src/lib/supabase";

interface VerifiedEmailIdentity {
  clerkUserId: string;
  email: string | null;
  emailVerified: boolean;
}

/** Claim matching unowned online orders. Safe to call on every account load. */
export async function claimGuestOrdersForIdentity(
  identity: VerifiedEmailIdentity,
): Promise<void> {
  if (!identity.emailVerified || !identity.email) return;

  const email = identity.email.trim().toLowerCase();
  if (email.length === 0) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[account] guest order claim skipped: Supabase is unavailable.");
    return;
  }

  const { error } = await supabase.rpc("claim_guest_orders", {
    p_clerk_user_id: identity.clerkUserId,
    p_verified_email: email,
  });

  if (error) {
    // Keep order/customer data and email addresses out of logs.
    console.error(`[account] guest order claim failed: ${error.message}`);
  }
}
