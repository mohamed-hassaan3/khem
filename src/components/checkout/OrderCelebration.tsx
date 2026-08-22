"use client";

/**
 * The moment after the money moves.
 *
 * ## What "celebrate" means here
 *
 * Not confetti. Expensive and festive are close to opposites, and a shower of
 * particles on an obsidian page would undo every restraint the rest of the site
 * exercises. The celebration is **light**: a hairline draws itself, the seal
 * settles, and a slow gold bloom rises behind it and stays. It reads as a
 * spotlight coming up on an object in a vitrine, which is the register the
 * whole house is written in.
 *
 * Every transition is `cubic-bezier(0.16, 1, 0.3, 1)` — `--ease-luxury-bezier`
 * — with zero spring and zero bounce, as AGENTS.md §2.2 requires.
 *
 * ## The sequence
 *
 * ```
 *    0ms  gold hairline draws outward from centre to 56px      600ms
 *  400ms  seal fades in, settles from scale(1.04) to scale(1)  900ms
 *  900ms  radial bloom rises to 18% opacity and stays         1200ms
 * 1100ms  eyebrow, headline, order number — 120ms stagger
 * 1800ms  the order card, as one block
 * 2100ms  the two calls to action
 * ```
 *
 * Implemented as CSS `animation` with `animation-delay` rather than a chain of
 * `setTimeout` and state updates: the compositor runs it, the timings cannot
 * drift under load, and there is no re-render per step. The keyframes live in
 * `src/app/globals.css` beside the site's other motion.
 *
 * ## Reduced motion
 *
 * Honoured properly. Under `prefers-reduced-motion: reduce` every element is
 * rendered in its final state with only opacity fading in — no transforms, no
 * draws, no bloom animation. The bloom itself stays, because it is a static
 * gradient once it has stopped moving, and removing it would leave the seal
 * floating in a void.
 *
 * ## Clearing the bag
 *
 * Not done here. `CheckoutView.goToConfirmation()` calls `clear()` before
 * navigating, which is the only place that knows the order actually succeeded.
 * Doing it in an effect on this page would empty the bag of anybody who lands
 * on the URL — including someone re-opening the link from their email.
 */

import Image from "next/image";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import { formatPrice } from "@/src/lib/format";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ACCOUNT_PATHS, AUTH_PATHS } from "@/src/lib/routes";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { OrderConfirmation } from "@/src/types/checkout";

export interface OrderCelebrationProps {
  order: OrderConfirmation;
  /** Signed-in visitors are sent to the portal; guests are offered an account. */
  isSignedIn: boolean;
  /** `en-US` formatted date string, built on the server. */
  placedOnLabel: string;
}

export default function OrderCelebration({
  order,
  isSignedIn,
  placedOnLabel,
}: OrderCelebrationProps) {
  const dict = useDictionary();
  const copy = dict.checkout.confirmed;

  const isCash = order.paymentMethod === "CASH";

  return (
    <section className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-6 py-24">
      {/*
       * The bloom. `pointer-events-none` and behind everything, sized in `vmin`
       * so it stays circular and proportionate from a 360px phone to a desktop.
       */}
      <div
        aria-hidden="true"
        className="khem-bloom pointer-events-none absolute left-1/2 top-[34%] h-[90vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2"
      />

      <div className="relative flex w-full max-w-lg flex-col items-center text-center">
        {/* 1. The hairline. */}
        <span
          aria-hidden="true"
          className="khem-rule-draw mb-10 block h-px bg-gold"
        />

        {/* 2. The seal. */}
        <div className="khem-seal-settle mb-10">
          <Image
            src="/email/khem-logo.png"
            alt=""
            width={128}
            height={128}
            priority
            className="h-28 w-28 sm:h-32 sm:w-32"
          />
        </div>

        {/* 3. The words, staggered. */}
        <p className="eyebrow khem-rise mb-4" style={{ animationDelay: "1100ms" }}>
          {copy.eyebrow}
        </p>

        <h1
          className="khem-rise mb-5 font-heading text-3xl font-normal leading-tight text-ivory sm:text-4xl"
          style={{ animationDelay: "1220ms" }}
        >
          {isCash ? copy.headingCash : copy.heading}
        </h1>

        <p
          className="khem-rise mb-10 max-w-md text-[13px] leading-loose text-ivory/45"
          style={{ animationDelay: "1340ms" }}
        >
          {isCash
            ? interpolate(copy.bodyCash, {
                amount: formatPrice(order.totalInCents),
              })
            : copy.body}
        </p>

        {/* 4. The card. */}
        <div
          className="khem-rise w-full border border-border bg-surface px-6 py-8 sm:px-9"
          style={{ animationDelay: "1800ms" }}
        >
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.24em] text-gold/60">
            {copy.orderNumber}
          </p>
          {/*
           * An LTR island: `KHEM-2026-1043` is a code, not a sentence, and
           * letting it reflow in Arabic puts the year in the wrong place.
           */}
          <p
            dir="ltr"
            className="mb-8 font-heading text-2xl tracking-[0.14em] text-gold"
          >
            {order.orderNumber}
          </p>

          <dl className="flex flex-col gap-3 border-t border-border pt-6 text-start">
            <Row label={copy.placedOn} value={placedOnLabel} />
            <Row
              label={copy.paymentMethod}
              value={isCash ? copy.cash : copy.card}
            />
            <Row
              label={copy.total}
              value={formatPrice(order.totalInCents)}
              emphasis
            />
          </dl>

          <ul className="mt-6 flex flex-col gap-2 border-t border-border pt-6 text-start">
            {order.lines.map((line) => (
              <li
                key={`${line.productName}-${line.quantity}`}
                className="flex items-baseline justify-between gap-4 text-[12px]"
              >
                <span className="text-ivory/60">{line.productName}</span>
                <span className="tabular-nums text-ivory/30">
                  &times;&nbsp;{line.quantity}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-7 border-t border-border pt-6 text-[11px] leading-relaxed text-ivory/30">
            {order.maskedEmail
              ? interpolate(copy.emailSent, { email: order.maskedEmail })
              : copy.emailSentGeneric}
          </p>
        </div>

        {/* 5. The way onward. */}
        <div
          className="khem-rise mt-10 flex w-full flex-col items-center gap-4"
          style={{ animationDelay: "2100ms" }}
        >
          <LocaleLink
            href={isSignedIn ? ACCOUNT_PATHS.orders : AUTH_PATHS.signUp}
            className="btn-luxury btn-luxury-fill w-full justify-center"
          >
            {isSignedIn ? copy.trackCta : copy.createAccountCta}
          </LocaleLink>

          <LocaleLink
            href="/collections"
            className="font-heading text-[11px] tracking-[0.15em] text-ivory/30 no-underline transition-colors duration-300 ease-out hover:text-ivory/60 focus-visible:text-gold focus-visible:outline-none"
          >
            {copy.continueCta}
          </LocaleLink>
        </div>
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[11px] tracking-[0.08em] text-ivory/35">{label}</dt>
      <dd
        className={
          emphasis
            ? "font-heading text-base tabular-nums text-gold"
            : "text-[12px] tabular-nums text-ivory/70"
        }
      >
        {value}
      </dd>
    </div>
  );
}
