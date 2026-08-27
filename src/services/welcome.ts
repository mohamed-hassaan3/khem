import "server-only";

/**
 * Claiming — and releasing — the right to welcome an account.
 *
 * A thin pair over `supabase/sql/0030_welcome.sql`. Everything that decides
 * anything is in that file: the claim is a conditional update, the voucher grant
 * is written in the same transaction, and both are unreachable without
 * `SUPABASE_SECRET_KEY` because `"User"` and `discount_grants` grant the public
 * roles nothing.
 *
 * The only caller is the Clerk webhook, and the only identifier it may pass is a
 * Clerk id it has just verified a signature over.
 *
 * ## Failing closed
 *
 * An unreachable database returns `claimed: false`, which means **no letter is
 * sent**. That is the right direction to fail: a welcome that did not go can be
 * sent by the next retry, and a welcome sent twice cannot be recalled.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import { toWelcomeClaim } from "@/src/schemas/db/welcome";
import type { WelcomeClaim } from "@/src/types/welcome";

const UNCLAIMED: WelcomeClaim = { claimed: false };

/**
 * Take the welcome, and the voucher that goes with it.
 *
 * Returns `claimed: false` when somebody already has it — a Clerk redelivery,
 * or a retry after a letter that did go out. The caller sends nothing in that
 * case, which is the whole of §7.1's "do not send duplicate welcome emails".
 */
export async function claimWelcome(clerkId: string): Promise<WelcomeClaim> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[welcome] SUPABASE_SECRET_KEY is not set; nothing claimed.");
    return UNCLAIMED;
  }

  const { data, error } = await supabase.rpc("claim_welcome", {
    payload: { clerkId },
  });

  if (error) {
    console.error(`[welcome] claim_welcome failed: ${error.message}`);
    return UNCLAIMED;
  }

  return toWelcomeClaim(data) ?? UNCLAIMED;
}

/**
 * Hand the claim back after a letter that could not be sent.
 *
 * The grant is deliberately **not** withdrawn — see the migration's header. The
 * customer now genuinely holds that privilege, it is already visible in their
 * account, and taking it away because a mail provider was down would punish
 * them for our outage.
 */
export async function releaseWelcome(clerkId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { error } = await supabase.rpc("release_welcome", {
    clerk_id: clerkId,
  });

  if (error) {
    console.error(`[welcome] release_welcome failed: ${error.message}`);
  }
}
