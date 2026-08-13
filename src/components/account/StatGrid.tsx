"use client";

import { formatPrice } from "@/src/lib/format";
import { useDictionary } from "@/src/providers/i18n-provider";
import { useWishlist } from "@/src/providers/wishlist-provider";
import type { AccountSummary } from "@/src/types/account";

/**
 * The three counts on the overview panel.
 *
 * All three numbers were literals before this change — an order count, a
 * lifetime total, and a saved-item count, printed identically for every
 * visitor regardless of who they were. Now:
 *
 *  - orders and lifetime spend come from `getAccountSummary`, which reads
 *    zero rows today and the real ones the day the `Order` table lands. The
 *    component does not change then;
 *  - the wishlist count is **live**, because saved fragrances already exist —
 *    they live in the browser, which is why this is a client component.
 *
 * Before hydration the browser's wishlist is unknown, so that tile shows an
 * em-dash rather than a `0` that would flicker to the real count. The same
 * reasoning as the hydration guard in `CartView`.
 */

export default function StatGrid({ summary }: { summary: AccountSummary }) {
  const dict = useDictionary();
  const { count, isHydrated } = useWishlist();

  const stats = [
    {
      key: "orders",
      value: String(summary.orderCount),
      label: dict.account.stats.orders,
      sub: dict.account.stats.allTime,
    },
    {
      key: "spent",
      value: formatPrice(summary.lifetimeSpendInCents),
      label: dict.account.stats.spent,
      sub: dict.account.stats.allTime,
    },
    {
      key: "wishlist",
      value: isHydrated ? String(count) : "—",
      label: dict.account.stats.wishlist,
      sub: dict.account.stats.saved,
    },
  ] as const;

  return (
    <div className="mb-15 grid grid-cols-1 gap-px sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.key} className="bg-surface px-8 py-9">
          <p className="mb-2 font-heading text-3xl font-semibold text-gold">
            {stat.value}
          </p>
          <p className="mb-1 font-heading text-[13px] text-ivory">
            {stat.label}
          </p>
          <p className="text-[11px] text-ivory/30">{stat.sub}</p>
        </div>
      ))}
    </div>
  );
}
