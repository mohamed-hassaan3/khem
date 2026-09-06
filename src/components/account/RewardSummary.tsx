import Price from "@/src/components/ecommerce/Price";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";
import type { CustomerRewards } from "@/src/types/rewards";

/**
 * What this customer has earned, in the four lines the brand asks for.
 *
 *     Your KHEM Rewards
 *     340 KHEM Points
 *     EGP 170 available
 *     60 points away from your next reward.
 *
 * ## Why it does not look like a loyalty card
 *
 * No progress bar, no tier badge, no stamps. A supermarket scheme uses those to
 * make a small benefit feel like an achievement; a house that sells a bottle for
 * three thousand pounds does not need to, and the machinery would read as
 * borrowed. The figures sit in the same gold-on-ivory panel the Discovery Credit
 * uses, so a customer holding both instruments sees them described the same way
 * rather than one dressed up.
 *
 * ## Why the last line earns its place
 *
 * A balance below the house's minimum is worth nothing yet, and a bare figure
 * would not say so. That sentence is the only thing on the panel that tells a
 * customer whether the number above it can be spent today — the same job
 * `CreditSummary`'s terms line does for a credit.
 */

export interface RewardSummaryProps {
  rewards: CustomerRewards;
  dict: Dictionary["account"]["vouchers"]["rewards"];
}

export default function RewardSummary({ rewards, dict }: RewardSummaryProps) {
  return (
    <div className="border border-ground-accent/20 bg-gold/6 px-6 py-8 sm:px-10 sm:py-10">
      <p className="eyebrow mb-4">{dict.available}</p>

      <p className="mb-2 font-heading text-4xl font-semibold tabular-nums text-ground-accent sm:text-5xl">
        {interpolate(dict.points, { points: String(rewards.balancePoints) })}
      </p>

      <p className="mb-5 font-heading text-[12px] tracking-[0.08em] text-ground-muted">
        {/*
          `<Price>` resolves the display currency in the browser, so the amount
          and the word beside it are two nodes rather than one interpolated
          string — the same composition `CreditSummary` uses.
        */}
        <Price cents={rewards.valueInCents} /> {dict.worth}
      </p>

      <p className="max-w-prose text-[12px] leading-loose text-ground-muted">
        {rewards.pointsToNextReward > 0
          ? interpolate(dict.toNext, {
              points: String(rewards.pointsToNextReward),
            })
          : dict.readyToSpend}
      </p>
    </div>
  );
}
