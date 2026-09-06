"use client";

/**
 * Spending KHEM Points.
 *
 * Rendered only for a signed-in customer whose balance has actually reached the
 * house's minimum — points belong to an account, and a guest never sees this
 * step at all. So does a customer holding forty points against a floor of a
 * hundred: an input they cannot use is worse than no input, because it promises
 * something and then refuses.
 *
 * ## The amount shown here is an estimate
 *
 * `CreditStep`'s reasoning, unchanged. The conversion is applied to a bag that
 * lives in the browser; the **server** decides what is actually taken off,
 * inside `place_order()`, under the advisory lock that serialises two checkouts
 * racing one balance. If the two ever disagree the server is right, which is why
 * the confirmation reads the order back rather than echoing this number.
 *
 * ## Why a slider and not a free number field
 *
 * The redeemable amount is bounded on three sides at once — the balance, the
 * house's per-order cap, and what is left of the merchandise after every other
 * benefit — and those bounds move as the customer edits the bag. A number field
 * invites a value that is out of range the moment it is typed and produces a
 * refusal the customer cannot act on. A range whose maximum *is* the bound
 * cannot be wrong, and it costs the customer no arithmetic.
 */

import { interpolate } from "@/src/lib/i18n/interpolate";
import { useFormatPrice } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";

export interface PointsWallet {
  /** What the customer holds right now. */
  balancePoints: number;
  /** The floor a redemption starts at. */
  minRedeemPoints: number;
  /** The conversion, as two numbers: `redeemPoints` are worth `redeemValueInCents`. */
  redeemPoints: number;
  redeemValueInCents: number;
  /** The house's per-order ceiling, or null for none. */
  maxPointsPerOrder: number | null;
}

/**
 * What a count of points is worth.
 *
 * Floored, matching `resolve_points_redemption()`: a figure a customer is shown
 * must never be larger than the one the checkout will honour.
 */
export function pointsValueInCents(points: number, wallet: PointsWallet): number {
  if (points <= 0 || wallet.redeemPoints <= 0) return 0;
  return Math.floor((points * wallet.redeemValueInCents) / wallet.redeemPoints);
}

/**
 * The most this customer could spend on this order.
 *
 * The three bounds, applied in the same order the database applies them, and
 * then rounded **down to a whole redemption step** so the number beside the
 * slider is always a clean conversion rather than an artefact of the cap.
 */
export function maxRedeemablePoints(
  wallet: PointsWallet,
  remainingInCents: number,
): number {
  if (wallet.redeemValueInCents <= 0 || wallet.redeemPoints <= 0) return 0;

  const byValue = Math.floor(
    (remainingInCents * wallet.redeemPoints) / wallet.redeemValueInCents,
  );

  const bounded = Math.min(
    wallet.balancePoints,
    byValue,
    wallet.maxPointsPerOrder ?? Number.POSITIVE_INFINITY,
  );

  if (bounded < wallet.minRedeemPoints) return 0;

  return Math.floor(bounded / wallet.redeemPoints) * wallet.redeemPoints;
}

export default function PointsStep({
  wallet,
  points,
  onChange,
  remainingInCents,
  disabledReason,
}: {
  wallet: PointsWallet;
  /** How many points the customer has chosen to spend. */
  points: number;
  onChange: (points: number) => void;
  /** What is left of the merchandise after every other benefit. */
  remainingInCents: number;
  /**
   * Why the step is inert, as a ready sentence — a code applied, a credit
   * selected, a promoted line in the bag. Null when it is usable.
   *
   * Shown rather than hidden: a customer who is told *why* points cannot be
   * combined has learned something, where a silently absent section teaches
   * nothing. The same choice `CreditStep` makes about ineligible credits.
   */
  disabledReason: string | null;
}) {
  const dict = useDictionary();
  const formatPrice = useFormatPrice();
  const copy = dict.checkout.points;

  // Below the floor there is nothing to offer, and saying so would be a promise
  // the customer cannot act on today.
  if (wallet.balancePoints < wallet.minRedeemPoints) return null;

  const max = maxRedeemablePoints(wallet, remainingInCents);
  const disabled = disabledReason !== null;
  const chosen = Math.min(points, max);
  const value = pointsValueInCents(chosen, wallet);

  return (
    <section className="mt-12">
      <h2 className="font-heading text-lg font-normal tracking-[0.1em] text-ground">
        {copy.heading}
      </h2>
      <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ground-muted">
        {interpolate(copy.lede, {
          points: String(wallet.balancePoints),
          amount: formatPrice(pointsValueInCents(wallet.balancePoints, wallet)),
        })}
      </p>

      {disabled ? (
        <p className="mt-5 border border-ground-border px-5 py-4 text-[12px] leading-relaxed text-ground-muted">
          {disabledReason}
        </p>
      ) : max === 0 ? (
        <p className="mt-5 border border-ground-border px-5 py-4 text-[12px] leading-relaxed text-ground-muted">
          {copy.nothingToReduce}
        </p>
      ) : (
        <div className="mt-6 border border-ground-border px-5 py-5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-heading text-[12px] tracking-[0.1em] text-ground-accent">
              {interpolate(copy.spending, { points: String(chosen) })}
            </span>
            <span className="font-heading text-[12px] tracking-[0.1em] text-ground-accent">
              {chosen > 0 ? `− ${formatPrice(value)}` : formatPrice(0)}
            </span>
          </div>

          <label htmlFor="points-amount" className="sr-only">
            {copy.heading}
          </label>
          <input
            id="points-amount"
            type="range"
            min={0}
            max={max}
            step={wallet.redeemPoints}
            value={chosen}
            onChange={(event) => onChange(Number(event.target.value))}
            className="mt-4 w-full accent-[var(--color-gold)]"
          />

          <div className="mt-2 flex items-center justify-between text-[11px] tracking-wide text-ground-muted/70">
            <span>0</span>
            <span>{interpolate(copy.max, { points: String(max) })}</span>
          </div>

          {chosen > 0 ? (
            <button
              type="button"
              onClick={() => onChange(0)}
              className="mt-4 cursor-pointer font-heading text-[11px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
            >
              {copy.clear}
            </button>
          ) : null}

          <p className="mt-4 text-[11px] leading-relaxed text-ground-muted/70">
            {copy.deliveryStillCharged}
          </p>
        </div>
      )}
    </section>
  );
}
