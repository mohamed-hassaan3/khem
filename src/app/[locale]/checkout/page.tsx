import type { Metadata } from "next";
import { headers } from "next/headers";

import CheckoutView from "@/src/components/checkout/CheckoutView";
import { getViewer } from "@/src/lib/auth";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { detectedCountryCode } from "@/src/lib/shipping";
import { isCardPaymentAvailable } from "@/src/lib/stripe/server";
import { getProductCardsByCollection } from "@/src/services/products";

/**
 * Checkout.
 *
 * ## Dynamic, unlike `/cart`
 *
 * The cart page is ISR because it renders no per-visitor data at all — the bag
 * is resolved in the browser. This page reads the Clerk session to pre-fill the
 * contact fields and to decide which call to action the confirmation offers, so
 * it must be rendered per request. AGENTS.md §8 lists `/checkout` as Force
 * Dynamic and here that is simply correct.
 *
 * ## Deliberately not protected
 *
 * `/checkout` is absent from the account and admin paths `src/proxy.ts` sheds,
 * because guest checkout is supported: a first-time buyer must be able to spend
 * money without first creating an account. `getViewer()` returning `null` is a
 * normal state on this route, not an error — the guest simply carries no
 * `clerkUserId` and their order does not appear in anybody's portal.
 *
 * ## Why the whole catalog is fetched
 *
 * `localStorage` is unreadable on the server, so the page cannot know *which*
 * products to fetch. A dozen card projections is cheaper than the round trip
 * that knowing would cost — the same reasoning `/cart` documents, and the same
 * projection, so the two pages resolve ids identically.
 */
export const dynamic = "force-dynamic";

const PATH = "/checkout";

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
      title: dict.checkout.meta.title,
      description: dict.checkout.meta.description,
    }),
    // A checkout is a session surface with nothing to index, and one that
    // should never appear in a search result. Links out of it may be followed.
    robots: { index: false, follow: true },
  };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [viewer, catalog, requestHeaders] = await Promise.all([
    getViewer(),
    getProductCardsByCollection(activeLocale),
    headers(),
  ]);

  /*
   * Where the visitor is, as Vercel's edge sees it — the same header
   * `src/proxy.ts` reads to pick a display currency. Null off Vercel, and the
   * form treats null as *unknown* rather than as *elsewhere*; see
   * `src/lib/shipping.ts`.
   *
   * Free to read here: this route is already `force-dynamic` for the session,
   * so nothing is opted out of caching that was not already.
   */
  const detectedCountry = detectedCountryCode(
    requestHeaders.get("x-vercel-ip-country"),
  );

  return (
    <CheckoutView
      locale={activeLocale}
      catalog={catalog}
      // Only the two fields the form pre-fills. The rest of `Viewer` — the id,
      // the avatar — has no business crossing into a client bundle here, and
      // the id in particular must never be something the client can echo back
      // as identity: `src/actions/checkout.ts` reads it from the session.
      viewer={
        viewer
          ? { fullName: viewer.fullName, primaryEmail: viewer.primaryEmail }
          : null
      }
      // Decided on the server: `STRIPE_SECRET_KEY` is not visible to the
      // browser, so the client cannot answer this question for itself.
      cardAvailable={isCardPaymentAvailable()}
      // Prefills the country and, when it is not Egypt, closes the checkout.
      // The refusal is enforced again in `placeCustomerOrder` — this prop only
      // decides what the visitor sees before they press anything.
      detectedCountry={detectedCountry}
    />
  );
}
