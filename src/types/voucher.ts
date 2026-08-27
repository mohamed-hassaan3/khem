/**
 * A voucher as one customer sees it.
 *
 * The house has no `vouchers` table and does not need one: a voucher *is* a row
 * of `discount_grants` (`supabase/sql/0028_discounts.sql`) read together with
 * the `discounts` row it entitles the holder to. This type is that pairing,
 * projected down to what a customer may be shown.
 *
 * Two things are deliberately absent.
 *
 * **An amount.** A voucher carries its *rule* — 15%, or EGP 200 off — never a
 * resolved saving, because what a code takes off depends on the bag it is
 * applied to and is computed by `resolve_discount()` inside the transaction
 * that writes the order. A number printed here would be a second opinion.
 *
 * **The public campaign codes.** Only grants are listed. A grant is addressed
 * to a person; an ungranted code is a campaign string, and listing every active
 * one to every signed-in visitor would turn the shop's marketing calendar into
 * a page anybody can read.
 */

import type { DiscountKind, DiscountScope } from "@/src/types/discount";

/**
 * What the customer is told about a voucher, derived at read time.
 *
 * Never stored — the same discipline as `CreditStatus` and for the same reason.
 * A status column beside the rows it summarises is a second record of one fact.
 *
 * `AVAILABLE` here means "nothing we can see prevents it". It is a description,
 * not a promise: `resolve_discount()` also weighs the total and per-customer
 * caps against the bag at checkout, and it is the only authority on the answer.
 */
export type VoucherStatus =
  /** Spent. `discount_grants.usedAt` is stamped. */
  | "USED"
  /** Past the grant's window, or past the campaign's `endsAt`. */
  | "EXPIRED"
  /** The campaign has been switched off. */
  | "UNAVAILABLE"
  /** Issued, but its campaign has not opened yet. */
  | "SCHEDULED"
  /** Ready to use. */
  | "AVAILABLE";

/** One voucher held by one customer. */
export interface CustomerVoucher {
  /** The grant's id. Never rendered into a URL — see the panel. */
  id: string;
  /** Uppercase, exactly as stored, and exactly what must be typed. */
  code: string;
  kind: DiscountKind;
  /** A percentage 1–100, or an amount in piastres. Read with `kind`. */
  value: number;
  /** Judged on the subtotal *before* any reduction. Zero means no minimum. */
  minimumOrderInCents: number;
  appliesTo: DiscountScope;
  description: string | null;
  /**
   * The address this grant is addressed to.
   *
   * The customer's own, never anybody else's — `vouchersForUser()` only returns
   * grants matched to this session. It is carried because both the gate in
   * `resolve_discount()` and the consumption in `place_order()` key on the
   * *order's* email, so a checkout can warn when the two differ instead of
   * letting the database refuse at the button.
   */
  grantedTo: string;
  issuedAt: string;
  /**
   * The earlier of the grant's expiry and the campaign's `endsAt`, or null when
   * neither is set. One date, because a customer asking "until when?" is owed
   * one answer rather than two that have to be reconciled.
   */
  expiresAt: string | null;
  /** The campaign's opening date, when it is still in the future. */
  startsAt: string | null;
  usedAt: string | null;
  status: VoucherStatus;
}
