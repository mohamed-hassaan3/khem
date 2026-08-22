import { SearchX } from "lucide-react";
import type { Metadata } from "next";

import OrderCelebration from "@/src/components/checkout/OrderCelebration";
import EmptyState from "@/src/components/ecommerce/EmptyState";
import { getUserId } from "@/src/lib/auth";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { getOrderForConfirmation } from "@/src/services/orders";

/**
 * The confirmation.
 *
 * Reached by both payment methods and by Stripe's `return_url` after an
 * off-site authentication step, always as `?order=KHEM-2026-1043`.
 *
 * ## The order is read on the server, from a deliberately thin projection
 *
 * Not passed through the URL as data, and not read from the client. An order
 * number is sequential and therefore guessable, so this page has to be safe to
 * open with somebody else's number — which is what
 * `getOrderForConfirmation()` is designed for: no address, no phone, no name,
 * no note, and an email masked before it leaves the server. See that function's
 * header before widening anything here.
 *
 * ## Why the status is not asserted
 *
 * A card order arrives here the instant Stripe confirms the payment, which is
 * often *before* the webhook has run — so the row may still say PENDING for a
 * second or two. The page therefore never claims a status it has not verified;
 * it says the order was received, which is true either way, and the emails
 * (sent from the webhook) carry the confirmation that money moved.
 */
export const dynamic = "force-dynamic";

const PATH = "/checkout/confirmed";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  return {
    ...localeMetadata({
      locale: activeLocale,
      path: PATH,
      title: dict.checkout.confirmed.meta.title,
      description: dict.checkout.confirmed.meta.description,
    }),
    // Never indexed and never followed: a crawler that finds one of these has
    // found somebody's receipt.
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutConfirmedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  const orderNumber = typeof query.order === "string" ? query.order.trim() : "";

  const [order, userId] = await Promise.all([
    orderNumber ? getOrderForConfirmation(orderNumber) : Promise.resolve(null),
    getUserId(),
  ]);

  if (!order) {
    return (
      <div className="min-h-screen bg-background pt-20 text-ivory">
        <EmptyState
          icon={SearchX}
          heading={dict.checkout.confirmed.notFound.heading}
          body={dict.checkout.confirmed.notFound.body}
          cta={dict.checkout.confirmed.notFound.cta}
          href="/"
        />
      </div>
    );
  }

  /*
   * Formatted here rather than in the client component, for the reason
   * `src/lib/format.ts` gives about dates: the server already knows the value
   * and the locale, and formatting on the client would mean the first paint
   * differs from the hydrated one.
   *
   * `en-US` on both trees, matching `formatArticleDate` — the Arabic tree keeps
   * Western digits rather than switching to Arabic-Indic mid-page.
   */
  const placedOnLabel = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(order.placedAt));

  return (
    <div className="min-h-screen bg-background pt-20 text-ivory">
      <OrderCelebration
        order={order}
        isSignedIn={userId !== null}
        placedOnLabel={placedOnLabel}
      />
    </div>
  );
}
