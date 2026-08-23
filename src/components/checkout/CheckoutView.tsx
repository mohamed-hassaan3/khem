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
 *   CASH → the action left it PENDING for the desk and sent both emails.
 *          Clear the bag, go to the confirmation.
 *   CARD → the order is PENDING. Ask `/api/checkout/intent` for a client
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
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import EmptyState from "@/src/components/ecommerce/EmptyState";
import PageHeader from "@/src/components/ecommerce/PageHeader";
import { placeCustomerOrder } from "@/src/actions/checkout";
import { cartSubtotalInCents, cartTotalInCents } from "@/src/lib/cart";
import { formatPrice } from "@/src/lib/format";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useCart } from "@/src/providers/cart-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { PaymentMethod } from "@/src/types/checkout";
import type { ProductCardData } from "@/src/types/catalog";

import CardPaymentForm from "./CardPaymentForm";
import ContactStep from "./ContactStep";
import DeliveryStep, { type DeliveryField } from "./DeliveryStep";
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
}

/** What a shopper in Egypt would otherwise have to type every time. */
const DEFAULT_COUNTRY = "Egypt";

interface PlacedOrder {
  orderId: string;
  orderNumber: string;
}

export default function CheckoutView({
  locale,
  catalog,
  viewer,
  cardAvailable,
}: CheckoutViewProps) {
  const dict = useDictionary();
  const router = useRouter();
  const { lines, isHydrated, clear } = useCart();

  const [customerName, setCustomerName] = useState(viewer?.fullName ?? "");
  const [customerEmail, setCustomerEmail] = useState(viewer?.primaryEmail ?? "");
  const [customerPhone, setCustomerPhone] = useState("");

  const [address, setAddress] = useState<Record<DeliveryField, string>>({
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: DEFAULT_COUNTRY,
    note: "",
  });

  // Cash is the default when Stripe is not configured, and the safer default
  // generally: it is the method that always works.
  const [method, setMethod] = useState<PaymentMethod>(
    cardAvailable ? "CARD" : "CASH",
  );

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

  /** Scrolled to when the server rejects something, so the message is seen. */
  const errorRef = useRef<HTMLDivElement>(null);

  const productsById = useMemo(
    () => new Map(catalog.map((product) => [product.id, product])),
    [catalog],
  );

  const resolved = useMemo(
    () =>
      lines.flatMap((line) => {
        const product = productsById.get(line.productId);
        return product ? [{ product, quantity: line.quantity }] : [];
      }),
    [lines, productsById],
  );

  const subtotalInCents = cartSubtotalInCents(
    resolved.map(({ product, quantity }) => ({
      priceInCents: product.priceInCents,
      quantity,
    })),
  );

  const totalInCents = cartTotalInCents(subtotalInCents);

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
    address.state.trim().length >= 2 &&
    address.country.trim().length >= 2;

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

  function goToConfirmation(orderNumber: string) {
    clear();
    router.push(
      `${localizePath(locale, "/checkout/confirmed")}?order=${encodeURIComponent(orderNumber)}`,
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || placedOrder !== null) return;

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
        country: address.country,
        note: address.note,
        company,
        items: lines.map((line) => ({
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
        showFailure(result.formError, result.detail);
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
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background pt-20 text-ivory">
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
      <div className="min-h-screen bg-background pt-20 text-ivory">
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

  return (
    <div className="min-h-screen bg-background pt-20 text-ivory">
      <PageHeader
        eyebrow={dict.checkout.eyebrow}
        heading={dict.checkout.heading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px]">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="px-4 py-10 sm:px-8 lg:px-14 lg:py-12 xl:px-20"
        >
          {/*
           * Frozen once an order exists. A `fieldset[disabled]` rather than a
           * per-field prop: it is one attribute, it covers anything added
           * later, and it is what assistive technology already understands.
           */}
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
            />
          </fieldset>

          <PaymentStep
            method={method}
            onMethodChange={(next) => {
              // Changing method after an order exists would mean the row says
              // CARD while the visitor pays cash. The panels are inert then.
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
              <p className="text-[12px] tracking-wide text-ivory/40">
                {dict.checkout.submit.preparing}
              </p>
            ) : null}
          </PaymentStep>

          {/*
           * Honeypot. Off-screen rather than `hidden`, which some bots skip.
           *
           * `h-0 w-0 overflow-hidden` is load-bearing, not belt-and-braces —
           * the same combination `ContactForm` uses. Without it the box keeps
           * its real size at `left:-9999px`, and in RTL that negative offset is
           * on the *inline-start* side, so the browser makes it scrollable:
           * `/ar/checkout` grew a 10,000px horizontal scroll. Collapsing the
           * box to zero leaves nothing to scroll to.
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

          <div ref={errorRef}>
            {formError ? (
              <div
                role="alert"
                className="mt-8 border border-danger/40 bg-danger/5 px-5 py-4"
              >
                <p className="text-[12px] tracking-wide text-danger">{formError}</p>
                {errorDetail ? (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ivory/40">
                    {errorDetail}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/*
           * The card branch grows its own submit inside the Elements form —
           * that button has to live where `useStripe()` is reachable. So this
           * one is for cash, and for the moment before a card order exists.
           */}
          {!awaitingPayment ? (
            <button
              type="submit"
              disabled={isPending}
              className="btn-luxury btn-luxury-fill mt-6 md:mt-10 w-full justify-center disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isPending
                ? dict.checkout.submit.working
                : method === "CASH"
                  ? dict.checkout.submit.cash
                  : interpolate(dict.checkout.submit.card, {
                      amount: formatPrice(totalInCents),
                    })}
            </button>
          ) : null}
        </form>

        <OrderReview lines={resolved} subtotalInCents={subtotalInCents} />
      </div>
    </div>
  );
}

/**
 * Absolute URL Stripe returns to after an off-site authentication step.
 *
 * Absolute because `return_url` leaves our origin and comes back; built from
 * `window.location.origin` rather than an env var so a preview deployment
 * returns to itself. Only reached in the browser, where `window` exists.
 */
function confirmationUrl(locale: Locale, orderNumber: string): string {
  const path = localizePath(locale, "/checkout/confirmed");
  return `${window.location.origin}${path}?order=${encodeURIComponent(orderNumber)}`;
}
