/**
 * Checkout vocabulary.
 *
 * Kept apart from `src/types/order.ts` — that file is the desk's and the
 * portal's shared language for an order that already exists. This one is about
 * an order being *made*: what the form posts, what the Server Action answers
 * with, and the deliberately thin projection the confirmation page is allowed
 * to read back.
 *
 * `OrderStatus` and `PaymentStatus` are not redeclared here for the reason
 * `types/order.ts` gives about not keeping two copies in step with
 * `supabase/sql/0015_orders.sql`.
 */

import type { OrderStatus } from "./account";
import type { DiscountRefusalCode } from "./discount";

/** Mirrors the `PaymentMethod` enum added in `supabase/sql/0016_checkout.sql`. */
export type PaymentMethod = "CARD" | "CASH";

/**
 * What the browser posts.
 *
 * **Identity only, in `items`.** A product id and a quantity, exactly what the
 * cart holds — no name, no price. Prices are read from the catalog under a row
 * lock inside `place_order()`, so a request cannot name what it pays.
 *
 * `company` is the honeypot. A real visitor never sees the field; a bot that
 * walked the DOM fills it, and the action answers success and does nothing.
 */
export interface CheckoutFormInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  locale: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  note: string;
  company: string;
  /**
   * A Discovery Credit to spend, or `""` for none.
   *
   * An **id only**. The amount, the owner and whether it may be used at all are
   * decided server-side inside `place_order()` — see
   * `supabase/sql/0027_credit_redemption.sql`.
   */
  creditId: string;
  /**
   * A discount code, or `""` for none.
   *
   * A **string only**. Its value and eligibility are computed server-side — see
   * `supabase/sql/0028_discounts.sql`.
   */
  discountCode: string;
  /**
   * KHEM Points to redeem, or `0`.
   *
   * A **count only**. The conversion rate, the caps and the balance are all read
   * server-side inside `place_order()` — see `supabase/sql/0059_rewards.sql`.
   */
  pointsToRedeem: number;
  items: readonly { productId: string; quantity: number }[];
}

/**
 * What `placeCustomerOrder` answers with.
 *
 * `fieldErrors` carries **dictionary keys**, not sentences — unlike the admin
 * actions in `src/schemas/orders.ts`, whose one reader is an English-only
 * dashboard. The storefront is bilingual, so the server names the problem and
 * the client looks up how to say it. `formError` is the same: a key.
 *
 * `orderId` is present only for a card order, because it is only the card path
 * that needs to ask for a PaymentIntent afterwards. The confirmation page never
 * receives it — it works from `orderNumber`.
 */
export type CheckoutResult =
  | {
      ok: true;
      orderNumber: string;
      paymentMethod: PaymentMethod;
      /** Opaque id, for `/api/checkout/intent`. Card orders only. */
      orderId?: string;
    }
  | {
      ok: false;
      /** Dictionary key under `dict.checkout.errors`. */
      formError: string;
      /**
       * Free-text detail the server could not have known in advance — "Nefertem
       * has only 2 in stock". Already written for a human, but only ever in
       * English; shown beneath the translated `formError`, never instead of it.
       */
      detail?: string;
      /**
       * The refusal `resolve_discount()` named, when the failure was a discount
       * code. Present only alongside `formError: "discountRejected"`, and only
       * against a database that has applied `0040` — so the English `detail`
       * remains the fallback rather than the exception.
       *
       * It exists so the sentence beneath the payment button is the sentence
       * the code field shows, in the language the visitor is reading.
       */
      reasonCode?: DiscountRefusalCode;
      fieldErrors?: Record<string, string>;
    };

/**
 * The confirmation page's read of an order.
 *
 * Deliberately thin, and the thinness is a security property rather than an
 * optimisation. Order numbers are sequential (`KHEM-2026-1043`), so anyone can
 * guess a neighbour's. Nothing in this shape is worth guessing for: no address,
 * no phone, no note, and an email that is masked before it leaves the server.
 *
 * See `getOrderForConfirmation` in `src/services/orders.ts`.
 */
export interface OrderConfirmation {
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  placedAt: string;
  subtotalInCents: number;
  shipInCents: number;
  totalInCents: number;
  /** `m•••@outlook.com` — enough to recognise, not enough to harvest. */
  maskedEmail: string | null;
  lines: readonly { productName: string; quantity: number }[];
}
