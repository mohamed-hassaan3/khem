/**
 * Turning a grant and its campaign into one customer-facing voucher.
 *
 * No new columns and no new query shape: this reads the rows
 * `src/schemas/db/discounts.ts` already parses and decides what a *customer*
 * may be told about them. It is a projection, and it lives beside its siblings
 * so the row vocabulary stays in one folder.
 *
 * The status is derived here rather than in the component, because a rule about
 * what "available" means belongs next to the rows it judges — and because the
 * panel must never be the second place that decides it.
 */

import type { Discount, DiscountGrant } from "@/src/types/discount";
import type { CustomerVoucher, VoucherStatus } from "@/src/types/voucher";

/** The earlier of two moments, ignoring the ones that are not set. */
function earliest(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return Date.parse(a) <= Date.parse(b) ? a : b;
}

function isPast(iso: string | null, now: number): boolean {
  return iso !== null && Date.parse(iso) <= now;
}

function isFuture(iso: string | null, now: number): boolean {
  return iso !== null && Date.parse(iso) > now;
}

/**
 * What the customer is told, in precedence order.
 *
 * Spent beats everything — a used voucher is used whatever else became true of
 * its campaign afterwards. Expiry beats deactivation, because "it ran out" is
 * the truer and kinder of the two explanations when both hold. Only a voucher
 * that survives all four tests is offered as available, so the panel can never
 * present an invalid code as though it would work.
 */
export function voucherStatus(
  grant: DiscountGrant,
  discount: Discount,
  now: number = Date.now(),
): VoucherStatus {
  if (grant.usedAt !== null) return "USED";
  if (isPast(grant.expiresAt, now) || isPast(discount.endsAt, now))
    return "EXPIRED";
  if (!discount.isActive) return "UNAVAILABLE";
  if (isFuture(discount.startsAt, now)) return "SCHEDULED";
  return "AVAILABLE";
}

/** One grant, read together with the campaign it entitles the holder to. */
export function toCustomerVoucher(
  grant: DiscountGrant,
  discount: Discount,
  now: number = Date.now(),
): CustomerVoucher {
  return {
    id: grant.id,
    code: discount.code,
    kind: discount.kind,
    value: discount.value,
    minimumOrderInCents: discount.minimumOrderInCents,
    appliesTo: discount.appliesTo,
    description: discount.description,
    grantedTo: grant.email,
    issuedAt: grant.issuedAt,
    expiresAt: earliest(grant.expiresAt, discount.endsAt),
    startsAt: discount.startsAt,
    usedAt: grant.usedAt,
    status: voucherStatus(grant, discount, now),
  };
}

/**
 * The order the panel lists them in: usable first, then the ones that will
 * become usable, then the ones that never will again.
 *
 * Ties break on expiry — the voucher about to lapse is the one worth acting on
 * — and then on issue date, newest first.
 */
const STATUS_RANK: Record<VoucherStatus, number> = {
  AVAILABLE: 0,
  SCHEDULED: 1,
  UNAVAILABLE: 2,
  EXPIRED: 3,
  USED: 4,
};

export function compareVouchers(
  a: CustomerVoucher,
  b: CustomerVoucher,
): number {
  const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (byStatus !== 0) return byStatus;

  // A voucher with no expiry sorts after the ones that have one; there is no
  // urgency to it.
  const aExpiry = a.expiresAt === null ? Infinity : Date.parse(a.expiresAt);
  const bExpiry = b.expiresAt === null ? Infinity : Date.parse(b.expiresAt);
  if (aExpiry !== bExpiry) return aExpiry - bExpiry;

  return Date.parse(b.issuedAt) - Date.parse(a.issuedAt);
}
