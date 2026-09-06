import type { Metadata } from "next";
import { headers } from "next/headers";

import CheckoutView from "@/src/components/checkout/CheckoutView";
import { getViewer } from "@/src/lib/auth";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { detectedCountryCode } from "@/src/lib/shipping";
import { isCardPaymentAvailable } from "@/src/lib/stripe/server";
import { getBenefitSettings } from "@/src/services/benefits";
import { spendableCreditsForUser } from "@/src/services/credits";
import { rewardBalanceForUser } from "@/src/services/rewards";
import { vouchersForUser } from "@/src/services/vouchers";
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
   * The credits this customer could spend, read **after** the session, because
   * they are keyed by it. A guest has none — a credit belongs to an account and
   * is not transferable — so the step is absent rather than empty.
   *
   * Only the three fields the selector renders cross into the bundle. The owner
   * is not among them: the server compares it against the session, and a value
   * the client could echo back would be an identity it could name.
   */
  const credits = viewer
    ? (await spendableCreditsForUser(viewer.id)).map((credit) => ({
        id: credit.id,
        amountInCents: credit.amountInCents,
        balanceInCents: credit.balanceInCents,
        expiresAt: credit.expiresAt,
      }))
    : [];

  /*
   * What this customer could spend in KHEM Points, and what the house says a
   * point is worth.
   *
   * Null in three cases that look identical to the visitor and should: a guest,
   * a house not running Rewards, and a customer holding nothing. In all three
   * there is no balance to offer.
   *
   * The settings are read regardless, because the same row carries the four
   * stacking switches — and those decide what the step *says* when it is inert,
   * which is a sentence the visitor needs whether or not they hold points.
   *
   * Only the conversion and the caps cross into the bundle, never the ledger:
   * the balance is one number, and `place_order()` re-reads it under a lock.
   */
  const benefits = await getBenefitSettings();

  const rewards =
    viewer && benefits.rewardsEnabled
      ? await rewardBalanceForUser(viewer.id).then((balance) =>
          balance.balancePoints > 0
            ? {
                balancePoints: balance.balancePoints,
                minRedeemPoints: benefits.minRedeemPoints,
                redeemPoints: benefits.redeemPoints,
                redeemValueInCents: benefits.redeemValueInCents,
                maxPointsPerOrder: benefits.maxPointsPerOrder,
              }
            : null,
        )
      : null;

  /*
   * The vouchers this customer holds and could use today — so they can pick one
   * instead of remembering a code (§5.5 of the plan).
   *
   * Grants only, keyed by the session: a public campaign code is not a personal
   * privilege, and listing every active one to every signed-in visitor would
   * publish the house's marketing calendar. A guest holds none, so the picker
   * is absent rather than empty.
   *
   * Four fields cross into the bundle. The grant id is not among them: choosing
   * a voucher only fills the code field, and the code is then checked and
   * redeemed through the same path a typed one takes — there is no privileged
   * route that a grant id could unlock.
   */
  const vouchers = viewer
    ? (
        await vouchersForUser({
          clerkUserId: viewer.id,
          email: viewer.primaryEmail,
        })
      )
        .filter((voucher) => voucher.status === "AVAILABLE")
        .map((voucher) => ({
          code: voucher.code,
          kind: voucher.kind,
          value: voucher.value,
          minimumOrderInCents: voucher.minimumOrderInCents,
          expiresAt: voucher.expiresAt,
          // The grant's *own* address, not the session's: a grant matched by
          // Clerk id may be addressed to another of this customer's addresses,
          // and the form warns against the one the database will match on.
          grantedTo: voucher.grantedTo,
        }))
    : [];

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
      // Suggestions only. Which credit may actually be spent, and for how much,
      // is decided inside `place_order()` — see `0027_credit_redemption.sql`.
      credits={credits}
      // Also suggestions. `resolve_discount()` decides, twice: once when the
      // customer presses Apply, and again inside the order transaction.
      vouchers={vouchers}
      // Also a suggestion. `resolve_points_redemption()` decides, under the
      // advisory lock, inside the order transaction.
      rewards={rewards}
      // Affordances, not the boundary. `place_order()` raises on every
      // combination these describe; naming them lets the step explain itself
      // before the customer meets the refusal at the payment button.
      pointsStacking={{
        withCodes: benefits.pointsStackWithCodes,
        withPromotions: benefits.pointsStackWithPromotions,
        withOffers: benefits.pointsStackWithOffers,
        withCredit: benefits.pointsStackWithCredit,
      }}
    />
  );
}
