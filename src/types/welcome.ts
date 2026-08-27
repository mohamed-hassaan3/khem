/**
 * The welcome claim.
 *
 * Mirrors what `claim_welcome()` in `supabase/sql/0030_welcome.sql` returns. A
 * discriminated union rather than an object with optional fields, because
 * "claimed nothing" and "claimed, with these details" are different answers and
 * the type should not let a caller read an address out of the first one.
 */

/** Nobody may send: the letter was already claimed, or there is no such account. */
interface WelcomeUnclaimed {
  claimed: false;
}

/** This caller holds the right to send exactly one welcome letter. */
interface WelcomeClaimed {
  claimed: true;
  /** The address on the account, as `sync_clerk_user()` stored it. */
  email: string;
  firstName: string | null;
  /**
   * The welcome voucher's code, or null when no welcome offer is running.
   *
   * When it is set, the grant behind it was written in the same transaction
   * that took this claim — so the code in the letter is one the checkout will
   * actually honour, which is what §7.2 of the plan requires.
   */
  code: string | null;
  /** When the grant lapses. Null when there is no code. */
  expiresAt: string | null;
}

export type WelcomeClaim = WelcomeUnclaimed | WelcomeClaimed;
