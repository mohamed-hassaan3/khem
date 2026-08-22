"use client";

/**
 * The card half of checkout.
 *
 * Mounted only after `placeCustomerOrder` has written a PENDING order and
 * `/api/checkout/intent` has answered with a client secret — so by the time
 * this renders, the bottles are already reserved and the amount is already
 * fixed by a row in the database. Nothing here can influence what is charged.
 *
 * ## Two components, because `<Elements>` is a provider
 *
 * `useStripe()` and `useElements()` only work *inside* `<Elements>`, so the
 * provider and the form that consumes it cannot be the same component. The
 * outer one owns the provider and the appearance; the inner one owns the
 * submit.
 *
 * ## `redirect: "if_required"`
 *
 * A plain card does not need a redirect, and keeping the visitor on the page
 * lets us show the confirmation without a round trip through Stripe's domain.
 * Methods that *do* require one — 3-D Secure, most wallets — still get it, and
 * come back to `return_url`. Both paths end at `/checkout/confirmed`.
 *
 * ## The order is already placed when this fails
 *
 * A decline is not a lost order; it is an order awaiting a second attempt. The
 * error is shown in place and the same intent is reused, so retrying does not
 * create a second order or a second reservation. Anything never retried is
 * cancelled and restocked by `/api/cron/sweep-unpaid-orders`.
 */

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useState, type FormEvent } from "react";

import { stripePromise } from "@/src/lib/stripe/client";
import { stripeAppearance } from "@/src/lib/stripe/appearance";
import { formatPrice } from "@/src/lib/format";
import { LOCALE_DIRECTION, type Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useDictionary } from "@/src/providers/i18n-provider";

export interface CardPaymentFormProps {
  clientSecret: string;
  locale: Locale;
  /** Absolute URL Stripe returns to after an off-site authentication step. */
  returnUrl: string;
  totalInCents: number;
  /** Clears the bag and navigates. Called only on a confirmed payment. */
  onSucceeded: () => void;
}

export default function CardPaymentForm({
  clientSecret,
  locale,
  returnUrl,
  totalInCents,
  onSucceeded,
}: CardPaymentFormProps) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: stripeAppearance,
        // Stripe's own strings — "Card number", "Expiry" — in the visitor's
        // language, so the iframe does not sit in English inside an Arabic page.
        locale,
      }}
    >
      <CardForm
        returnUrl={returnUrl}
        totalInCents={totalInCents}
        onSucceeded={onSucceeded}
        dir={LOCALE_DIRECTION[locale]}
      />
    </Elements>
  );
}

interface CardFormProps {
  returnUrl: string;
  totalInCents: number;
  onSucceeded: () => void;
  dir: "ltr" | "rtl";
}

function CardForm({ returnUrl, totalInCents, onSucceeded, dir }: CardFormProps) {
  const dict = useDictionary();
  const stripe = useStripe();
  const elements = useElements();

  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  /** Stripe's own decline reason, in Stripe's own words. Shown beneath ours. */
  const [detail, setDetail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // `stripe` is null until Stripe.js has loaded. Submitting before then would
    // silently do nothing, so the button is disabled and this is the backstop.
    if (!stripe || !elements || isPaying) return;

    setIsPaying(true);
    setError(null);
    setDetail(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(dict.checkout.errors.payment);
      // `message` is present on card errors and absent on API errors; the
      // former is written for the cardholder ("Your card was declined") and is
      // worth showing verbatim.
      setDetail(confirmError.message ?? null);
      setIsPaying(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      // Deliberately not left enabled. The webhook is what actually promotes
      // the order; this only moves the visitor to the confirmation, and a
      // second click must not be possible while that navigation happens.
      onSucceeded();
      return;
    }

    // `processing` and `requires_action` both mean "not finished, not failed".
    // The webhook will settle it; the visitor should not be left on a spinner,
    // so they are moved on and the confirmation page reads the real status.
    if (
      paymentIntent?.status === "processing" ||
      paymentIntent?.status === "requires_action"
    ) {
      onSucceeded();
      return;
    }

    setError(dict.checkout.errors.payment);
    setIsPaying(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/*
       * `dir` on the wrapper, not on the iframe: Stripe controls the inside and
       * takes its direction from the `locale` option. This aligns the box, the
       * error, and the button with the rest of the page.
       */}
      <div dir={dir}>
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      {error ? (
        <div role="alert" className="mt-5">
          <p className="text-[12px] tracking-wide text-danger">{error}</p>
          {detail ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-ivory/35">
              {detail}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!stripe || isPaying}
        className="btn-luxury btn-luxury-fill mt-8 w-full justify-center disabled:cursor-not-allowed disabled:opacity-45"
      >
        {isPaying
          ? dict.checkout.submit.working
          : interpolate(dict.checkout.submit.card, {
              amount: formatPrice(totalInCents),
            })}
      </button>
    </form>
  );
}
