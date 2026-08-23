"use client";

import { useFormatPrice } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { AccountSummary } from "@/src/types/account";

/**
 * The two counts on the overview panel.
 *
 * Both come from `getAccountSummary`, which reads real rows: an order count
 * and lifetime spend. A third tile counted saved fragrances out of the
 * browser; it went when saving did, and took the last piece of browser state
 * this component read with it.
 *
 * It nonetheless stays a **client** component. `useFormatPrice()` is the whole
 * reason: the displayed currency is a per-visitor choice resolved after
 * hydration (see `currency-provider.tsx`), so lifetime spend cannot be
 * formatted on the server without pinning every visitor to the base currency.
 */

export default function StatGrid({ summary }: { summary: AccountSummary }) {
  const dict = useDictionary();
  const formatPrice = useFormatPrice();

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
  ] as const;

  return (
    <div className="mb-15 grid grid-cols-1 gap-px sm:grid-cols-2">
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
