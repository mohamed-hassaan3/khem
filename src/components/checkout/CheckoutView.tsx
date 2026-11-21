"use client";

/**
 * The checkout island.
 *
 * `/checkout` is a Server Component that knows the locale, the dictionary, the
 * signed-in viewer, and the whole catalog projection — but it cannot know
 * what is in the bag, because the bag lives in `localStorage`. So the page
 * hands this component the catalog and this component resolves the stored ids
 * against it, exactly as `CartView` does on `/cart`, and for the same three
 * reasons: live prices, no ghost lines, and nothing from `localStorage` ever
 * rendered as text.
 *
 * ## The two submit paths
 *
 * Both call `placeCustomerOrder`, which writes the order and reserves its
 * stock. They diverge on what happens next:
 *
 *   CASH → the action left it PROCESSING for the desk and sent both emails.
 *          Clear the bag, go to the confirmation.
 *   CARD → the order is PROCESSING. Ask `/api/checkout/intent` for a client
 *          secret, mount the Payment Element, and let Stripe take it from
 *          there. The bag is cleared only once the payment is confirmed.
 *
 * The card path therefore has two phases, and `placedOrder` is what
 * distinguishes them: null means "collecting details", set means "an order
 * exists and is waiting to be paid". Once it is set, the contact and delivery
 * fields are frozen — the address is already on a row in Postgres, and letting
 * somebody edit it after the fact would show them one thing and ship to
 * another.
 *
 * ## Why the bag is cleared late
 *
 * `clear()` runs on success and never before. A visitor whose card is declined
 * still has their bag; a visitor who closes the tab mid-payment still has their
 * bag. The abandoned order is cancelled and restocked by the sweeper.
 */

import { ShoppingBag } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import NavGround from "@/src/components/NavGround";
import EmptyState from "@/src/components/ecommerce/EmptyState";
import PageHeader from "@/src/components/ecommerce/PageHeader";
import { placeCustomerOrder } from "@/src/actions/checkout";
import { previewDiscount } from "@/src/actions/discounts";
import { previewCartOffer } from "@/src/actions/offers";
import { sameAddress } from "@/src/lib/address-match";
import {
  cartTotalInCents,
  clampQuantity,
  parseBuyNow,
  shippingInCents,
} from "@/src/lib/cart";
import { useDeliveryTerms } from "@/src/providers/delivery-provider";
import { useSiteFooterInView } from "@/src/hooks/use-site-footer-in-view";
import { discountRefusalMessage } from "@/src/lib/discount-message";
import { cartPricing } from "@/src/lib/pricing";
import { formatPrice } from "@/src/lib/format";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import {
  SHIPPING_COUNTRY,
  countryLabel,
  selectableCountry,
} from "@/src/lib/shipping";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useCart } from "@/src/providers/cart-provider";
import { useFormatPrice } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { CheckoutSavedAddress, PaymentMethod } from "@/src/types/checkout";
import type { ProductCardData } from "@/src/types/catalog";
import type { DiscountPreview } from "@/src/types/discount";
import type { OfferPreview } from "@/src/types/offer";

import CardPaymentForm from "./CardPaymentForm";
import CheckoutDisclosure from "./CheckoutDisclosure";
import CheckoutProgress from "./CheckoutProgress";
import CheckoutSummaryBar from "./CheckoutSummaryBar";
import OrderTotals, { reviewTotalInCents } from "./OrderTotals";
import ContactStep from "./ContactStep";
import DeliveryStep, { type DeliveryField } from "./DeliveryStep";
import CreditStep, { type SpendableCredit } from "./CreditStep";
import DiscountStep, { type AppliedDiscount } from "./DiscountStep";
import PointsStep, {
  maxRedeemablePoints,
  pointsValueInCents,
  type PointsWallet,
} from "./PointsStep";
import type { CheckoutVoucher } from "./VoucherPicker";
import OrderReview from "./OrderReview";
import PaymentStep from "./PaymentStep";

export interface CheckoutViewProps {
  locale: Locale;
  /** Every sellable product, for id resolution. */
  catalog: readonly ProductCardData[];
  /** Pre-fill from the Clerk session. Null for a guest. */
  viewer: { fullName: string | null; primaryEmail: string | null } | null;
  /** Whether both Stripe keys are present. Decided on the server. */
  cardAvailable: boolean;
  /**
   * The customer's Egyptian saved addresses, default first. Empty for a guest.
   *
   * The first one fills the delivery fields. Editing them changes this order
   * only. Nothing here is ever written back to the address book except
   * through the "Save this address" checkbox, which adds a new entry.
   */
  savedAddresses: readonly CheckoutSavedAddress[];
  /**
   * ISO-3166 alpha-2 for where the request came from, or null when unknown.
   *
   * Null means *unknown*, never *elsewhere*: the country field stays editable
   * and the order goes through, exactly as it did before detection existed.
   * See `src/lib/shipping.ts`.
   */
  detectedCountry: string | null;
  /**
   * Discovery Credits this customer could spend. Empty for a guest.
   *
   * A **suggestion list**, not a permission: `place_order()` re-reads the
   * credit under a row lock and decides for itself. See `CreditStep`.
   */
  credits: readonly SpendableCredit[];
  /**
   * Vouchers granted to this customer that are usable today. Empty for a guest.
   *
   * Also a suggestion list. Choosing one only fills the field; it is then
   * checked and later redeemed through exactly the same path a typed code
   * takes, so nothing here is a shortcut past `resolve_discount()`.
   */
  vouchers: readonly CheckoutVoucher[];
  /**
   * This customer's KHEM Points and the house's conversion, or null.
   *
   * Null covers three cases that look identical to the visitor and should: a
   * guest, a house not running Rewards, and a customer who holds nothing. In all
   * three there is no balance to offer, so the step does not render.
   *
   * A **suggestion**, not a permission — `place_order()` re-reads the balance
   * under an advisory lock and prices the redemption itself.
   */
  rewards: PointsWallet | null;
  /**
   * Which benefits the house permits beside KHEM Points.
   *
   * Mirrors the four `pointsStackWith*` columns on `"BenefitSetting"`, and it is
   * an **affordance only**: `place_order()` raises on every combination these
   * describe, so this exists to explain the refusal before the customer meets it
   * rather than to prevent one.
   */
  pointsStacking: {
    withCodes: boolean;
    withPromotions: boolean;
    withOffers: boolean;
    withCredit: boolean;
  };
}

interface PlacedOrder {
  orderId: string;
  orderNumber: string;
}

export default function CheckoutView({
  locale,
  catalog,
  viewer,
  cardAvailable,
  savedAddresses,
  detectedCountry,
  credits,
  vouchers,
  rewards,
  pointsStacking,
}: CheckoutViewProps) {
  const dict = useDictionary();
  // The house's delivery terms, read once in the layout.
  const deliveryTerms = useDeliveryTerms();
  // The phone's sticky action bar steps aside while the footer is on screen.
  const footerInView = useSiteFooterInView();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lines, isHydrated, clear } = useCart();

  /*
   * Where the edge says the visitor is, reduced to something the dropdown can
   * actually show. A code outside the list — `T1` from a Tor exit, `XX` from
   * traffic the edge could not place — is treated as no answer rather than
   * selecting an option that does not exist.
   */
  const detected = selectableCountry(detectedCountry);

  const [customerName, setCustomerName] = useState(viewer?.fullName ?? "");
  const [customerEmail, setCustomerEmail] = useState(viewer?.primaryEmail ?? "");
  const [customerPhone, setCustomerPhone] = useState("");

  /** Empty means "no credit". The server treats it the same way. */
  const [creditId, setCreditId] = useState("");

  /**
   * Empty means "no code". Checked before payment, never priced here — the
   * amount comes from `resolve_discount()` through `previewDiscount`.
   *
   * The two are mutually exclusive, so selecting a credit clears any code and
   * the code field disables itself; the database refuses both regardless.
   */
  const [discountCode, setDiscountCode] = useState("");

  /**
   * A code the server has priced, **stamped with the order it was priced for**.
   *
   * The stamp is what makes the applied state safe to hold in state at all. A
   * discount is an estimate against one particular bag, email and credit
   * selection; the moment any of those moves, the estimate describes an order
   * nobody is about to place. Rather than watching for that in an effect and
   * clearing it — a cascading render, and one the linter rightly refuses — the
   * signature is compared during render and a stale estimate simply stops
   * counting. See `activeDiscount` below.
   */
  const [applied, setApplied] = useState<
    (AppliedDiscount & { signature: string }) | null
  >(null);

  /** The last refusal from the server, shown at the field. */
  const [discountRefusal, setDiscountRefusal] = useState<
    Extract<DiscountPreview, { ok: false }> | null
  >(null);

  const [checkingDiscount, startDiscountCheck] = useTransition();

  const [address, setAddress] = useState<Record<DeliveryField, string>>(() =>
    savedAddresses[0]
      ? // A saved address is always Egyptian (the page filters), so the country
        // is Egypt whatever the edge detected: the customer told us where they
        // live, which outranks a GeoIP guess.
        { ...fieldsFrom(savedAddresses[0]), note: "" }
      : {
          line1: "",
          line2: "",
          city: "",
          state: "",
          postalCode: "",
          /*
           * An ISO-3166 code here, not a name — this one field is a chooser
           * rather than a text box, and a code is what a chooser has stable
           * values for. `countryLabel()` turns it into the words that reach
           * `"Order"."shipCountry"` at submit, in the order's own language.
           *
           * Starts wherever the edge says the visitor is ("Another country"
           * when that is off the short list), and at Egypt when it cannot say.
           * Either way it is a starting point: choosing in the dropdown is what
           * actually decides the order. See `selectableCountry`.
           */
          country: detected.code,
          note: "",
        },
  );

  /** "Save this address to my profile". Off until the customer ticks it. */
  const [saveToProfile, setSaveToProfile] = useState(false);

  // Cash is the default when Stripe is not configured, and the safer default
  // generally: it is the method that always works.
  const [method, setMethod] = useState<PaymentMethod>(
    cardAvailable ? "CARD" : "CASH",
  );

  /*
   * The visitor's currency, for the one figure a refusal can carry — the
   * minimum an offer applies from. The module-level `formatPrice` above stays
   * where it is: it prints the base-currency total on the card button, which is
   * the amount Stripe is actually given.
   */
  const formatDisplayPrice = useFormatPrice();

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  /**
   * Honeypot. Hidden from sight and from the tab order, so only a bot walking
   * the DOM fills it. The action reports success and writes nothing.
   */
  const [company, setCompany] = useState("");

  /** How many KHEM Points the customer has chosen to spend. */
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  /**
   * The offer the house is giving on this bag, as `resolve_offer()` priced it.
   *
   * Null is the ordinary answer, not a failure: most baskets earn no offer.
   */
  const [offer, setOffer] = useState<OfferPreview | null>(null);

  /** Scrolled to when the server rejects something, so the message is seen. */
  const errorRef = useRef<HTMLDivElement>(null);

  const productsById = useMemo(
    () => new Map(catalog.map((product) => [product.id, product])),
    [catalog],
  );

  /*
   * ── Buy Now ────────────────────────────────────────────────
   *
   * A direct purchase: `/checkout?buy=<productId>&qty=<n>`, written by
   * `<BuyNowButton>`. When one resolves, **it replaces the bag for this
   * screen** — the customer pressed a button meaning "this bottle", and
   * checking out three other things alongside it is not what they asked for.
   *
   * The bag itself is untouched throughout, including on success: see
   * `goToConfirmation()`.
   *
   * `null` is the ordinary case and also the degraded one. An id that matches
   * nothing in the catalogue — archived since the link was shared, or simply
   * mistyped — falls back to the bag rather than erroring, so a stale link
   * behaves like an ordinary trip to the checkout.
   */
  const directLine = useMemo(() => {
    const request = parseBuyNow(searchParams);
    if (request === null) return null;

    const product = productsById.get(request.productId);
    if (!product) return null;

    return {
      productId: product.id,
      // Clamped against stock the page actually knows, so a hand-typed
      // `?qty=999` shows the number the server would enforce rather than a
      // total it is about to refuse.
      quantity: clampQuantity(request.quantity, product.inventory),
    };
  }, [searchParams, productsById]);

  /**
   * What this checkout is about: the one direct line, or the bag.
   *
   * Everything downstream reads this rather than `lines` — the pricing, the
   * discount signature, the discount preview payload and the order payload — so
   * there is no path by which the customer could be shown one basket and
   * charged for another.
   */
  const activeLines = useMemo(
    // Memoised, not inlined: `[directLine]` is a fresh array on every render,
    // and handing that to the memo below would rebuild the resolved basket —
    // and everything priced from it — on every keystroke in the address form.
    () => (directLine !== null ? [directLine] : lines),
    [directLine, lines],
  );

  const resolved = useMemo(
    () =>
      activeLines.flatMap((line) => {
        const product = productsById.get(line.productId);
        return product ? [{ product, quantity: line.quantity }] : [];
      }),
    [activeLines, productsById],
  );

  /*
   * The same breakdown the bag page shows, from the same function. `subtotal`
   * below is the promoted figure — what the merchandise actually costs — and is
   * what every calculation on this screen uses: the delivery fee, the credit
   * cap, the discount preview, and the total.
   */
  const pricing = cartPricing(resolved);
  const subtotalInCents = pricing.subtotalInCents;

  /*
   * What the selected credit would take off, by the same `min(credit, subtotal)`
   * rule `place_order()` applies. An **estimate**: the server recomputes it
   * against the order it writes, and what the customer is charged is what the
   * order row says. The card path proves that — `/api/checkout/intent` reads
   * `totalInCents` off the row and refuses to be told an amount.
   *
   * Applied against merchandise only, so delivery is still charged.
   */
  const selectedCredit = credits.find((credit) => credit.id === creditId) ?? null;

  /*
   * What the applied code was priced against. Any change to the bag, the
   * address the grant gate reads, or the credit selection produces a different
   * signature — and a different signature means the estimate is no longer about
   * this order.
   */
  const discountSignature = [
    activeLines
      .map((line) => `${line.productId}:${line.quantity}`)
      .sort()
      .join(","),
    customerEmail.trim().toLowerCase(),
    creditId,
  ].join("|");

  /** The discount that actually counts — never a stale one. */
  const activeDiscount =
    applied !== null && applied.signature === discountSignature ? applied : null;

  /** A code was applied and then the order moved beneath it. */
  const discountStale = applied !== null && activeDiscount === null;

  const discountInCents = activeDiscount?.amountInCents ?? 0;

  /*
   * ── The offer the house is giving ──────────────────────────
   *
   * Asked for whenever the bag, the address the audience gate reads, the typed
   * code or the credit selection changes — the last two because an offer that
   * will not stack with either declines itself, and the customer must see it
   * withdraw rather than discover at the button that it never applied.
   *
   * `cancelled` guards against a slower earlier request landing after a faster
   * later one and re-showing an offer the current bag no longer earns.
   */
  const offerSignature = [
    activeLines
      .map((line) => `${line.productId}:${line.quantity}`)
      .sort()
      .join(","),
    customerEmail.trim().toLowerCase(),
    activeDiscount?.code ?? "",
    creditId,
  ].join("|");

  useEffect(() => {
    let cancelled = false;

    /*
     * An empty bag resolves to `null` through the same `.then` rather than
     * clearing the state outright. Setting it synchronously in an effect body
     * causes the cascading render `react-hooks/set-state-in-effect` warns about,
     * and going through a microtask both silences that and keeps one code path
     * for "what this bag is worth".
     */
    const request =
      activeLines.length === 0
        ? Promise.resolve(null)
        : previewCartOffer({
            items: activeLines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
            })),
            locale,
            customerEmail,
            discountCode: activeDiscount?.code ?? "",
            usingCredit: creditId !== "",
          });

    void request.then((result) => {
      if (!cancelled) setOffer(result);
    });

    return () => {
      cancelled = true;
    };
    // `offerSignature` is the whole of what this depends on: it is built from
    // every input above, and listing them separately would re-run the effect on
    // a keystroke that did not change the answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerSignature, locale]);

  const offerInCents = Math.min(offer?.amountInCents ?? 0, subtotalInCents);

  /*
   * ── KHEM Points ────────────────────────────────────────────
   *
   * The ladder `place_order()` walks, in the same order and with the same caps,
   * so the figure beside the button is the figure the order is written with.
   * Every reduction is applied against what the one before it left.
   *
   * The refusals are affordances, not the boundary: the database raises on each
   * of these combinations. Naming them here means the customer reads why the
   * step is inert instead of losing the redemption at the payment button.
   */
  const pointsBlockedBy =
    rewards === null
      ? null
      : activeDiscount !== null && !pointsStacking.withCodes
        ? dict.checkout.points.blockedByCode
        : offer !== null && !pointsStacking.withOffers
          ? dict.checkout.points.blockedByOffer
          : creditId !== "" && !pointsStacking.withCredit
            ? dict.checkout.points.blockedByCredit
            : pricing.promotionSavingsInCents > 0 && !pointsStacking.withPromotions
              ? dict.checkout.points.blockedByPromotion
              : null;

  const remainingAfterOfferAndCode = Math.max(
    0,
    subtotalInCents - offerInCents - discountInCents,
  );

  const redeemablePoints =
    rewards === null || pointsBlockedBy !== null
      ? 0
      : maxRedeemablePoints(rewards, remainingAfterOfferAndCode);

  const spentPoints = Math.min(pointsToRedeem, redeemablePoints);
  const pointsInCents =
    rewards === null ? 0 : pointsValueInCents(spentPoints, rewards);

  const creditCapInCents = Math.max(
    0,
    remainingAfterOfferAndCode - pointsInCents,
  );

  const creditAppliedInCents = selectedCredit
    ? Math.min(selectedCredit.balanceInCents, creditCapInCents)
    : 0;

  const totalInCents =
    cartTotalInCents(subtotalInCents, deliveryTerms) -
    offerInCents -
    discountInCents -
    pointsInCents -
    creditAppliedInCents;

  /*
   * Purely visual: the gold tick on a completed section. Not validation — the
   * schema decides that, on the server. These only answer "has this section
   * been filled in at all?", which is what the tick claims.
   */
  const contactComplete =
    customerName.trim().length >= 2 &&
    customerEmail.includes("@") &&
    customerPhone.trim().length >= 7;

  const deliveryComplete =
    address.line1.trim().length >= 4 &&
    address.city.trim().length >= 2 &&
    // address.state.trim().length >= 2 &&
    address.country.trim().length >= 2;

  /*
   * Whether this order can be delivered at all.
   *
   * Read from the **chosen** country, not from the header. Detection decided
   * what that choice started as; a visitor the edge placed in the wrong country
   * picks Egypt from the dropdown and the checkout reopens, which is the only
   * behaviour that survives contact with VPNs and mobile carriers.
   *
   * Presentation only. `checkoutSchema` refuses a non-Egyptian country on the
   * server, where a disabled button cannot be re-enabled from a console.
   */
  const shipsHere = address.country === SHIPPING_COUNTRY;

  /*
   * Whether the fields currently describe an address already in the book. The
   * same comparison the server uses to skip a duplicate save, so the checkbox
   * is never offered for a save that would do nothing.
   */
  const matchesSaved = savedAddresses.some((saved) =>
    sameAddress({ ...saved, country: SHIPPING_COUNTRY }, address),
  );
  const canSave = viewer !== null && !matchesSaved;

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleContactChange(
    field: "customerName" | "customerEmail" | "customerPhone",
    value: string,
  ) {
    clearFieldError(field);
    if (field === "customerName") setCustomerName(value);
    if (field === "customerEmail") setCustomerEmail(value);
    if (field === "customerPhone") setCustomerPhone(value);
  }

  function handleDeliveryChange(field: DeliveryField, value: string) {
    clearFieldError(field);
    setAddress((current) => ({ ...current, [field]: value }));
  }

  /** A saved-address chip: refill the address, keep the delivery note. */
  function applySavedAddress(saved: CheckoutSavedAddress) {
    for (const field of ["line1", "line2", "city", "state", "postalCode", "country"]) {
      clearFieldError(field);
    }
    setAddress((current) => ({ ...fieldsFrom(saved), note: current.note }));
  }

  /*
   * "+ New" on the saved-address row: blank the address fields so a different
   * one can be typed. Client state only; the country stays Egypt and the note
   * is kept. Nothing is saved or deleted.
   */
  function startNewAddress() {
    for (const field of ["line1", "line2", "city", "state", "postalCode"]) {
      clearFieldError(field);
    }
    setAddress((current) => ({
      ...current,
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      country: SHIPPING_COUNTRY,
    }));
  }

  /** Resolve a server-sent key against the dictionary; never render the key. */
  function messageFor(key: string): string {
    const errors = dict.checkout.errors as Record<string, string>;
    return errors[key] ?? errors.server;
  }

  function showFailure(key: string, detail?: string) {
    setFormError(messageFor(key));
    setErrorDetail(detail ?? null);
    // The panel is at the foot of a long form; without this the visitor sees
    // nothing happen when they press the button.
    requestAnimationFrame(() =>
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  /**
   * Ask the server what this code is worth against the bag as it stands.
   *
   * `override` exists for the voucher picker: it fills the field and applies in
   * one gesture, and `setDiscountCode` has not settled by the time its click
   * handler runs.
   *
   * The result is stamped with `discountSignature`, so it stops counting by
   * itself if the order moves underneath it.
   */
  function applyDiscount(override?: string) {
    if (awaitingPayment) return;

    const code = (override ?? discountCode).trim();
    if (code === "" || checkingDiscount) return;

    setDiscountRefusal(null);

    startDiscountCheck(async () => {
      const result = await previewDiscount({
        code,
        // The address the order will carry — what the grant gate matches on.
        customerEmail,
        items: activeLines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
      });

      if (!result.ok) {
        setApplied(null);
        setDiscountRefusal(result);
        return;
      }

      // Stored as the server returned it: uppercase, and priced by SQL.
      setApplied({
        code: result.code,
        amountInCents: result.amountInCents,
        signature: discountSignature,
      });
      setDiscountCode(result.code);
    });
  }

  function removeDiscount() {
    setApplied(null);
    setDiscountRefusal(null);
    setDiscountCode("");
  }

  function goToConfirmation(orderNumber: string) {
    /*
     * Only a cart purchase empties the cart.
     *
     * A direct purchase never took anything out of the bag, so it has nothing
     * to put back and nothing to clear — emptying it here would delete a bag
     * the customer built and did not buy.
     */
    if (directLine === null) clear();
    router.push(
      `${localizePath(locale, "/checkout/confirmed")}?order=${encodeURIComponent(orderNumber)}`,
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || placedOrder !== null) return;

    // The button is already disabled; this catches the Enter key and anything
    // that re-enables it from a console. The action refuses regardless.
    if (!shipsHere) {
      showFailure("outsideEgypt");
      return;
    }

    /*
     * A code typed but never applied. Sending it anyway would either discount
     * an order the customer was never shown a discount for, or fail the whole
     * placement on a code they had not committed to — so they are asked to
     * apply it or clear it. Nothing is guessed on their behalf.
     */
    if (discountCode.trim() !== "" && activeDiscount === null) {
      showFailure("discountNotApplied");
      return;
    }

    setFormError(null);
    setErrorDetail(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await placeCustomerOrder({
        customerName,
        customerEmail,
        customerPhone,
        paymentMethod: method,
        locale,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        // The code becomes words here, once, on its way to the database: a
        // picking slip reads "Egypt", not "EG".
        country: countryLabel(address.country, locale),
        note: address.note,
        // Only while the box is visible: a tick left behind on an address that
        // has since been changed back to a saved one is not a request.
        saveAddress: canSave && saveToProfile,
        company,
        creditId,
        /*
         * Only a code the server has already priced against this exact bag.
         * `place_order()` resolves it again under a lock and may still refuse
         * it — a cap can fill in the seconds between — but the customer is
         * never charged for a code they were not shown applied.
         */
        discountCode: activeDiscount?.code ?? "",
        /*
         * A count, and only one the step actually offered. `redeemablePoints`
         * is zero whenever the step is inert — a code applied, an offer running,
         * a credit chosen — so a stale selection cannot survive the customer
         * changing their mind and reach the order.
         */
        pointsToRedeem: spentPoints,
        items: activeLines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
      });

      if (!result.ok) {
        if (result.fieldErrors) {
          setFieldErrors(
            Object.fromEntries(
              Object.entries(result.fieldErrors).map(([field, key]) => [
                field,
                messageFor(key),
              ]),
            ),
          );
        }
        /*
         * A discount refused at the button reads exactly as it reads at the
         * field: same function, same dictionary. Only when the database did
         * not name the reason — a build older than `0040`, or a refusal this
         * one cannot name — does the server's English sentence stand in.
         */
        showFailure(
          result.formError,
          result.reasonCode === undefined
            ? result.detail
            : discountRefusalMessage(
                { ok: false, reasonCode: result.reasonCode, reason: result.detail ?? "" },
                dict.checkout.discount,
                locale,
                formatDisplayPrice,
              ),
        );
        return;
      }

      if (result.paymentMethod === "CASH") {
        goToConfirmation(result.orderNumber);
        return;
      }

      // Card: the order exists and holds its stock. Now ask for a secret.
      if (!result.orderId) {
        showFailure("paymentSetup");
        return;
      }

      const placed = { orderId: result.orderId, orderNumber: result.orderNumber };
      setPlacedOrder(placed);

      try {
        const response = await fetch("/api/checkout/intent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderId: placed.orderId }),
        });

        const payload: unknown = await response.json();

        const secret =
          typeof payload === "object" &&
          payload !== null &&
          "clientSecret" in payload &&
          typeof (payload as { clientSecret: unknown }).clientSecret === "string"
            ? (payload as { clientSecret: string }).clientSecret
            : null;

        if (!response.ok || secret === null) {
          showFailure("paymentSetup");
          return;
        }

        setClientSecret(secret);
      } catch {
        showFailure("paymentSetup");
      }
    });
  }

  /*
   * Before hydration the bag is unknown — the server rendered this page without
   * it. Showing the empty state here would flash "your cart is empty" at every
   * returning visitor, so the page holds its height instead. Same treatment as
   * `CartView`.
   */
  // A direct purchase does not read the bag, so it need not wait for it.
  if (!isHydrated && directLine === null) {
    return (
      <div className="ground-ivory min-h-screen">
      {/* §16: trust, clarity, readability. No hero, so the header is solid. */}
      <NavGround ground="ivory" />
        <PageHeader
          eyebrow={dict.checkout.eyebrow}
          heading={dict.checkout.heading}
        />
        <div className="min-h-[60vh]" aria-hidden="true" />
      </div>
    );
  }

  // An order in flight keeps the page rendered even if the bag empties beneath
  // it — which it does not today, but would the moment `clear()` moves earlier.
  if (resolved.length === 0 && placedOrder === null) {
    return (
      <div className="ground-ivory min-h-screen">
        <PageHeader
          eyebrow={dict.checkout.eyebrow}
          heading={dict.checkout.heading}
        />
        <EmptyState
          icon={ShoppingBag}
          heading={dict.checkout.empty.heading}
          body={dict.checkout.empty.body}
          cta={dict.checkout.empty.cta}
          href="/collections"
        />
      </div>
    );
  }

  const awaitingPayment = placedOrder !== null;

  /*
   * Display figures for the redesigned phone checkout (Stage 2,
   * `prompts/storefront-redesign-stage-2.md` D10). The same arithmetic the
   * review sidebar has always printed (`reviewTotalInCents`), in the visitor's
   * display currency. Nothing here is submitted: the action reprices the order
   * on the server, and the card button keeps its base-currency amount.
   */
  const adjustments = {
    creditAppliedInCents,
    discountInCents,
    offerInCents,
    offerLabel: offer?.label ?? null,
    pointsInCents,
  };
  const displayTotal = formatDisplayPrice(
    reviewTotalInCents(pricing, deliveryTerms, adjustments),
  );
  const shippingDisplay = shippingInCents(subtotalInCents, deliveryTerms);
  const itemCount = resolved.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="ground-ivory min-h-screen">
      {/* The page heading stays for assistive tech; on a phone the task header and the summary bar are the top of the page. */}
      <div className="sr-only lg:not-sr-only">
        <PageHeader
          eyebrow={dict.checkout.eyebrow}
          heading={dict.checkout.heading}
        />
      </div>

      <CheckoutSummaryBar
        itemCount={itemCount}
        total={displayTotal}
        className="lg:hidden"
      >
        <OrderReview
          lines={resolved}
          pricing={pricing}
          variant="lines"
          {...adjustments}
        />
      </CheckoutSummaryBar>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px]">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="px-4 pb-28 pt-3 sm:px-8 lg:px-14 lg:py-12 xl:px-20"
        >
          <CheckoutProgress
            contactComplete={contactComplete}
            deliveryComplete={deliveryComplete}
            className="lg:hidden"
          />

          <fieldset disabled={awaitingPayment} className="contents">
            <ContactStep
              name={customerName}
              email={customerEmail}
              phone={customerPhone}
              onChange={handleContactChange}
              errors={fieldErrors}
              complete={contactComplete}
              sessionEmail={viewer?.primaryEmail ?? null}
            />

            <DeliveryStep
              values={address}
              onChange={handleDeliveryChange}
              errors={fieldErrors}
              complete={deliveryComplete}
              countryDetected={detected.detected && savedAddresses.length === 0}
              shipsHere={shipsHere}
              savedAddresses={savedAddresses}
              onApplySaved={applySavedAddress}
              onNewAddress={startNewAddress}
              deliveryLine={
                shippingDisplay === 0
                  ? dict.checkout.review.complimentary
                  : formatDisplayPrice(shippingDisplay)
              }
              deliveryIsFree={shippingDisplay === 0}
              canSave={canSave}
              saveToProfile={saveToProfile}
              onSaveToProfileChange={setSaveToProfile}
            />
          </fieldset>

          <PaymentStep
            method={method}
            onMethodChange={(next) => {
              if (!awaitingPayment) setMethod(next);
            }}
            cardAvailable={cardAvailable}
            totalInCents={totalInCents}
          >
            {clientSecret && placedOrder ? (
              <CardPaymentForm
                clientSecret={clientSecret}
                locale={locale}
                returnUrl={confirmationUrl(locale, placedOrder.orderNumber)}
                totalInCents={totalInCents}
                onSucceeded={() => goToConfirmation(placedOrder.orderNumber)}
              />
            ) : awaitingPayment ? (
              <p className="text-[12px] tracking-wide text-ground-muted">
                {dict.checkout.submit.preparing}
              </p>
            ) : null}
          </PaymentStep>

          {/*
            The optional reductions, each behind a quiet row under the payment
            step. They open by themselves when something is applied, chosen,
            refused or stale, so nothing that affects the total is ever hidden.
            Their logic and props are exactly as before.
          */}
          <div className="divide-y divide-ground-border border-y border-ground-border">
            <CheckoutDisclosure
              title={dict.checkout.discount.heading}
              forceOpen={
                activeDiscount !== null ||
                discountRefusal !== null ||
                discountStale ||
                discountCode !== "" ||
                creditId !== ""
              }
            >
              <DiscountStep
                embedded
                code={discountCode}
                onChange={(next) => {
                  if (awaitingPayment) return;
                  setDiscountCode(next);
                  setDiscountRefusal(null);
                }}
                disabledByCredit={creditId !== ""}
                onApply={applyDiscount}
                onRemove={removeDiscount}
                pending={checkingDiscount}
                applied={activeDiscount}
                refusal={discountRefusal}
                stale={discountStale}
                vouchers={vouchers}
                email={customerEmail}
                locale={locale}
              />
            </CheckoutDisclosure>

            {rewards ? (
              <CheckoutDisclosure
                title={dict.checkout.points.heading}
                forceOpen={spentPoints > 0}
              >
                <PointsStep
                  embedded
                  wallet={rewards}
                  points={spentPoints}
                  onChange={(next) => {
                    if (awaitingPayment) return;
                    setPointsToRedeem(next);
                  }}
                  remainingInCents={remainingAfterOfferAndCode}
                  disabledReason={pointsBlockedBy}
                />
              </CheckoutDisclosure>
            ) : null}

            {credits.length > 0 ? (
              <CheckoutDisclosure
                title={dict.checkout.credit.heading}
                forceOpen={creditId !== ""}
              >
                <CreditStep
                  embedded
                  credits={credits}
                  selectedId={creditId}
                  onSelect={(next) => {
                    if (awaitingPayment) return;
                    setCreditId(next);
                    if (next !== "") {
                      setDiscountCode("");
                      setApplied(null);
                      setDiscountRefusal(null);
                      if (!pointsStacking.withCredit) setPointsToRedeem(0);
                    }
                  }}
                  subtotalInCents={subtotalInCents}
                  locale={locale}
                />
              </CheckoutDisclosure>
            ) : null}
          </div>

          {/*
            Honeypot. Off-screen and out of the tab order; only a bot fills it,
            and the action drops a submission that has.
          */}
          <div
            aria-hidden="true"
            className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
          >
            <label htmlFor="checkout-company">Company</label>
            <input
              id="checkout-company"
              name="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            />
          </div>

          {/* The totals once more, at the point of decision (phones; the sidebar does this from `lg`). */}
          <div className="mt-6 rounded-lg border border-ground-border p-4 lg:hidden">
            <OrderTotals pricing={pricing} {...adjustments} />
          </div>

          <div ref={errorRef}>
            {formError ? (
              <div
                role="alert"
                className="mt-6 rounded-md border border-danger/40 bg-danger/5 px-5 py-4 lg:mt-8"
              >
                <p className="text-[12px] tracking-wide text-danger">{formError}</p>
                {errorDetail ? (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ground-muted">
                    {errorDetail}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {!awaitingPayment && !shipsHere ? (
            <p
              role="note"
              className="mt-6 rounded-md border border-ground-accent/30 bg-gold/5 px-5 py-3 text-[12px] leading-relaxed text-ground-muted"
            >
              {dict.checkout.errors.outsideEgypt}
            </p>
          ) : null}

          {/*
            The submit. On a phone it rides in a bar fixed to the bottom of the
            screen (still inside this <form>, still type="submit"), and steps
            aside while the footer is on screen. From `lg` it sits in the flow
            as before. Hidden while a card payment is being taken, where
            Stripe's own form has the button.
          */}
          {!awaitingPayment ? (
            <div
              className={[
                "ground-ivory z-40 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:border-t max-lg:border-ground-border max-lg:bg-ground-bg/97 max-lg:px-4 max-lg:pt-2.5 max-lg:pb-[max(0.625rem,env(safe-area-inset-bottom))] max-lg:backdrop-blur-sm",
                "transition-transform duration-500 ease-luxury-bezier motion-reduce:transition-none lg:mt-10",
                footerInView ? "max-lg:translate-y-full" : "translate-y-0",
              ].join(" ")}
            >
              <button
                type="submit"
                disabled={isPending || !shipsHere}
                className="btn btn-primary h-13 w-full justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isPending
                  ? dict.checkout.submit.working
                  : method === "CASH"
                    ? interpolate(dict.checkout.submit.cashTotal, {
                        amount: displayTotal,
                      })
                    : interpolate(dict.checkout.submit.card, {
                        amount: formatPrice(totalInCents),
                      })}
              </button>
            </div>
          ) : null}
        </form>

        <div className="hidden lg:block">
          <OrderReview lines={resolved} pricing={pricing} {...adjustments} />
        </div>
      </div>
    </div>
  );
}

function fieldsFrom(
  saved: CheckoutSavedAddress,
): Omit<Record<DeliveryField, string>, "note"> {
  return {
    line1: saved.line1,
    line2: saved.line2 ?? "",
    city: saved.city,
    state: saved.state,
    postalCode: saved.postalCode,
    country: SHIPPING_COUNTRY,
  };
}

function confirmationUrl(locale: Locale, orderNumber: string): string {
  const path = localizePath(locale, "/checkout/confirmed");
  return `${window.location.origin}${path}?order=${encodeURIComponent(orderNumber)}`;
}
