# Order Mail Deliverability, Delivered-Copy Fix, Feedback Request Email & Egypt-Only Checkout

## Goal

Four changes, all in the order lifecycle:

1. **House notification lands in the Outlook inbox, not Junk.** `khem.official@outlook.com`
   must receive the new-order picking slip in the inbox. No visitor-facing surface
   changes at all — this touches only sender/header/content shape of one internal email
   (plus the manual DNS/Outlook steps handed back at the end).
2. **The `delivered` customer email stops asking for money.** It currently prints
   "Please have {amount} ready for the courier" on a cash order that has *already* been
   paid and delivered. That sentence must not appear on the delivered message.
3. **A new feedback-request email**, sent to the customer **24 hours after delivery**, in
   the same luxury shell as the other customer letters, listing the items they bought,
   each item linking straight to that product's comment area.
4. **Checkout country is auto-detected from the visitor's location.** If they are outside
   Egypt they are warned and the order **cannot** be placed — enforced on the server, not
   just in the UI.

## Skills read

None. `AGENTS.md` §4 restricts skills to `clerk`, `supabase`, `ai-sdk`. This task touches
no Clerk surface beyond the existing `getViewer()` read, adds no AI, and the Supabase work
is one migration written in the shape the existing `supabase/sql/*.sql` files already
establish. The session hook proposed `ai-sdk` and `chat-sdk` on a lexical match of the
word "email"/"send" — not a topic match, and deliberately not loaded.

## Existing code inspected

| File | What it settled |
| :--- | :--- |
| `src/lib/email/addresses.ts` | `fromAddress()` (`noreply@khemperfumes.com`), `houseFromAddress()` (`HOUSE_EMAIL`), `inboxAddress()` (DB-backed concierge), `orderInboxAddress()` (`khem.official@outlook.com`, `ORDER_NOTIFICATION_EMAIL` override). All env-overridable. |
| `src/lib/email/send-order-mail.ts` | `notifyHouseOfOrder` sends `from: fromAddress()`, `to: orderInboxAddress()`, `replyTo: <customer email>`. `notifyCustomerOfOrder(order, kind)` sends the luxury shell with the inline logo. Everything is best-effort and never throws. `mailKindForStatus()` maps `OrderStatus` → `OrderMailKind`. |
| `src/lib/email/order-templates.ts` | `customerOrderEmail()` builds all five moods from one body; `paymentBlock()` prints `cashInstruction` whenever `paymentMethod === "CASH"`, and is included whenever `isOpen` — which includes `delivered`. That is bug #2. `newOrderNotificationEmail()` is the internal picking slip. |
| `src/lib/email/order-copy.ts` | `ORDER_COPY: Record<Locale, Record<OrderMailKind, OrderMessageCopy>>` and `ORDER_LABELS`. Author-trusted prose, interpolated raw; visitor data is escaped at the template. |
| `src/lib/email/layout.ts` | `luxuryShell`, `paragraph`, `mutedParagraph`, `ctaButton`, `signoff`, `spacer` — the customer-letter primitives. |
| `src/lib/email/headers.ts` | `AUTO_REPLY_HEADERS` (`Auto-Submitted: auto-replied`, `X-Auto-Response-Suppress: All`) — applied to customer mail only. |
| `src/services/orders.ts` | `mailRowSchema` / `OrderMailRecord`: items are `{ productName, quantity, priceInCents }` — **no slug**, though `"OrderItem"."productSlug"` exists. `getOrderForMail(id)`, `getOrderForMailByNumber(number)`. |
| `supabase/sql/0015_orders.sql` | `"Order"` and `"OrderItem"` (has `"productSlug"`, indexed). RLS on, **no policy**, no public grants — only the secret key reaches these rows. Stock and status move inside SQL functions, never in TypeScript. |
| `supabase/sql/0017_order_events.sql` | `"OrderStatusEvent"(orderId, status, occurredAt)`, append-only, written inside `set_order_status()`. This is where "when was it delivered" already lives — no new timestamp column is needed for *that*. |
| `src/app/api/cron/sweep-unpaid-orders/route.ts` | The house cron shape: `runtime = "nodejs"`, `force-dynamic`, `CRON_SECRET` bearer compared with `timingSafeEqual`, fail-closed when unset, work done in one RPC, numbers logged and never customers. |
| `vercel.json` | One cron today (`0 3 * * *`). Hobby permits **two** cron jobs and **daily** schedules only — the existing route's comment says so explicitly. |
| `src/proxy.ts`, `src/lib/currency.ts` | `x-vercel-ip-country` is already read in the proxy and mapped by `resolveCurrencyForCountry()`; the header is treated as untrusted and a country is never fabricated. This is the geolocation contract to reuse — no new dependency. |
| `src/components/checkout/CheckoutView.tsx` | `DEFAULT_COUNTRY = "Egypt"`, `address` state, `deliveryComplete`, `messageFor(key)` → `dict.checkout.errors[key]`, `showFailure()`. Submit calls `placeCustomerOrder({...})`. |
| `src/components/checkout/DeliveryStep.tsx`, `CheckoutField.tsx` | The country field is a plain text `CheckoutField` with `autoComplete="country-name"`. |
| `src/schemas/checkout.ts` | `country: z.string().trim().min(2, "country").max(80, "countryLong")` — error *keys*, resolved against the dictionary on the client. |
| `src/actions/checkout.ts` | Parses with `checkoutSchema`, then `shipCountry: parsed.data.country`. Returns `{ ok:false, formError, fieldErrors, detail }`. |
| `src/app/[locale]/checkout/page.tsx` | Already `force-dynamic` and already a Server Component passing props into `CheckoutView` — so reading `headers()` here costs nothing. |
| `src/components/ecommerce/ProductComments.tsx` | The comment section: `<section className="border-t border-border …">`, no `id`. Rendered by `/perfume/[slug]` and `/ritual/[slug]`. Returns `null` when Supabase is unconfigured. |
| `src/lib/routes.ts` | `productHref({ slug, collectionKind })`, `hasDetailPage()` — DISCOVERY and GIFT have no detail page. |
| `src/lib/i18n/dictionaries/{en,ar}.ts` | `checkout.delivery.*`, `checkout.errors.*` — both locales must gain every new key or it is a compile error. |

## Decisions and assumptions

1. **Junk-folder fix, part one (code).** The single strongest Outlook junk signal this
   message carries is a `Reply-To` on a *different domain from the `From`* — every order
   notification replies-to a stranger's gmail/hotmail address. It is dropped. The
   customer's address is already a row in the picking slip ("Contact"), so nothing is
   lost except one-click reply. Alongside that: the notification gains a dedicated,
   stable sender identity `KHEM Orders <orders@khemperfumes.com>` (new
   `orderFromAddress()`, `RESEND_ORDER_FROM_EMAIL` override, same verified domain so
   Resend can send it), and the `Auto-Submitted` / `X-Auto-Response-Suppress` headers are
   **not** added here — they are for the customer auto-replies and would not help.
   `X-Entity-Ref-ID: <orderNumber>` is added so repeated sends never thread/collapse.
2. **Junk-folder fix, part two (manual, and it is the decisive half).** No code change
   can override an Outlook user's junk verdict. The implementation ends with exact steps
   for: (a) confirming SPF + DKIM + a DMARC record for `khemperfumes.com` in Resend/DNS,
   (b) adding `orders@khemperfumes.com` to Outlook **Safe senders**, (c) an Outlook rule
   "from orders@khemperfumes.com → move to Inbox, never junk", (d) marking any existing
   junked order mail as "Not junk". These are handed to the user, not automated.
3. **Delivered mail drops the cash instruction only — not the whole payment panel.**
   "Payment: Cash on delivery" is still true and still useful on a delivered receipt.
   `paymentBlock()` takes the `kind` and prints `cashInstruction` only for
   `confirmation` and `shipped`. No copy string is deleted from `order-copy.ts`; the two
   messages that still owe money still need it.
4. **The feedback email is a sixth message, deliberately outside `OrderMailKind`.**
   `OrderMailKind` is the *status* mapping (`mailKindForStatus` switches exhaustively
   over `OrderStatus`); adding a member that no status maps to would weaken that. Instead:
   `FEEDBACK_COPY: Record<Locale, OrderMessageCopy>` in `order-copy.ts`,
   `customerFeedbackEmail()` in `order-templates.ts`, `notifyCustomerOfFeedbackRequest()`
   in `send-order-mail.ts`. Same `luxuryShell`, same inline logo, same
   `AUTO_REPLY_HEADERS`, same `order.locale`.
5. **"24 hours after delivery" is a daily cron, and that is stated honestly.** Hobby
   allows one run per day, so the letter goes out on the next scheduled pass at or after
   the 24-hour mark — between 24 and 48 hours after delivery in practice. The window is
   bounded on the other side too (delivered no more than 30 days ago), so switching the
   database on after a quiet month does not mail a year of old orders. On Pro, tighten the
   schedule; nothing else changes.
6. **Idempotency is a stored column, not a guess.** New migration
   `supabase/sql/0022_order_feedback.sql`: `"Order"."feedbackRequestedAt" timestamptz`, a
   partial index, an RPC `orders_awaiting_feedback(older_than_hours int, max_rows int)`
   returning the ids of DELIVERED orders whose DELIVERED `"OrderStatusEvent"` is old
   enough and whose `"feedbackRequestedAt"` is null, and `mark_feedback_requested(order_id)`.
   Selection lives in SQL for the same reason `expire_unpaid_orders` does. The stamp is
   written **before** the send (a duplicate letter is worse than a missing one, and every
   send here is best-effort anyway).
7. **Per-item links need the collection kind, which `"OrderItem"` does not store.** The
   feedback record joins `"OrderItem"."productSlug"` to `"Product"` for
   `slug`/`collectionKind`, and the href is
   `SITE_URL + localizePath(order.locale, productHref(...)) + "#comments"`. An item whose
   product no longer exists, or is a DISCOVERY/GIFT set with no detail page, is listed as
   plain text with no link rather than linked to a 404.
8. **`#comments` becomes a real anchor.** `<ProductComments>` gains
   `id="comments"` and `scroll-mt-24 md:scroll-mt-32` so the sticky header does not cover
   the heading. This is the only visitor-facing markup change in the whole task and it is
   invisible until someone follows the link.
9. **Country detection is server-side and untrusted-by-default.** The checkout page reads
   `x-vercel-ip-country` (the header the proxy already trusts for currency) and passes
   `detectedCountry: string | null` into `CheckoutView`. When it is present the country
   field renders **read-only**, showing the resolved display name via
   `Intl.DisplayNames(locale)`, with a small caption saying it was detected. When it is
   absent — local dev, any non-Vercel host — the field stays editable and defaults to
   "Egypt", exactly as today. A missing header must never block a sale.
10. **The block is enforced in the Server Action, and it is the header that decides.**
    `placeCustomerOrder` reads `x-vercel-ip-country` itself via `headers()` and refuses
    with `formError: "outsideEgypt"` when it is present and not `EG`. A typed country
    string is *also* validated (allowlist: `Egypt`, `مصر`, `EG`, `EGY`, case/space
    insensitive) so a hand-edited payload cannot walk past a missing header. The client
    check is a courtesy that shows the warning early and disables the button; the action
    is the actual gate.
11. **The warning is a notice, not an error.** Outside Egypt, the delivery step shows a
    bordered gold/danger panel — "KHEM ships within Egypt only" plus the concierge email —
    and the Place Order button is disabled. No copy claims international shipping is
    "coming soon", because nobody has decided that.

## Files likely to change

**Email**
- `src/lib/email/addresses.ts` — add `orderFromAddress()`.
- `src/lib/email/send-order-mail.ts` — new sender identity + `X-Entity-Ref-ID`, drop the
  cross-domain `replyTo`, add `notifyCustomerOfFeedbackRequest()`.
- `src/lib/email/order-copy.ts` — `FEEDBACK_COPY`, plus `FEEDBACK_LABELS` additions
  (`shareYourThoughts`, `leaveAComment`) in both locales.
- `src/lib/email/order-templates.ts` — `paymentBlock(order, locale, kind)`,
  `customerFeedbackEmail()` + its text alternative, a linked item list.

**Data**
- `supabase/sql/0022_order_feedback.sql` — new migration (column, index, two functions,
  grants revoked from the public roles like every sibling file).
- `src/services/orders.ts` — `feedbackRowSchema` / `OrderFeedbackRecord` (items carry
  `productSlug`, `collectionKind`), `listOrdersAwaitingFeedback()`,
  `markFeedbackRequested()`, `getOrderForFeedback()`.

**Cron**
- `src/app/api/cron/order-feedback/route.ts` — new route, `CRON_SECRET` guard copied in
  shape from the sweeper.
- `vercel.json` — second cron entry, daily.

**Checkout**
- `src/app/[locale]/checkout/page.tsx` — read the geo header, pass `detectedCountry`.
- `src/components/checkout/CheckoutView.tsx` — detected country state, `shipsToEgypt`
  gate, disabled submit, warning panel wiring.
- `src/components/checkout/DeliveryStep.tsx` — read-only country field + caption + notice.
- `src/schemas/checkout.ts` — Egypt allowlist refinement on `country`.
- `src/actions/checkout.ts` — header read + refusal.
- `src/lib/i18n/dictionaries/en.ts`, `ar.ts` — new `checkout.delivery.*` and
  `checkout.errors.outsideEgypt` keys, both locales.

**Product page**
- `src/components/ecommerce/ProductComments.tsx` — `id="comments"` + scroll margin.

## Implementation requirements

- Strict TypeScript, zero `any`. Every new exported function documented in the voice of
  the file it lands in.
- Every string that comes from an `"Order"` row — product name, customer name, address —
  goes through `escapeHtml` in the template. Author prose from `order-copy.ts` does not.
- Every new email keeps a `text/plain` alternative; a letter without one is a spam score.
- The feedback send is best-effort: it swallows every failure, logs order number and
  provider message only, and never throws. No customer data in logs.
- The cron route fails **closed** when `CRON_SECRET` is unset (500) and returns 401 on a
  bad token, matching the sweeper exactly.
- Money is formatted with `formatPrice` and the base currency, no argument — a receipt
  records what was charged, not a browsing convenience.
- New dictionary keys land in **both** `en` and `ar`, and `FEEDBACK_COPY` is
  `Record<Locale, …>` so a missing translation is a compile error.
- Arabic keeps RTL alignment through the existing `alignFor(locale)` / `opposite()` helpers;
  the order number and any price stay LTR islands.
- No new npm dependency. `Intl.DisplayNames` is platform-native.

## Security requirements

- `x-vercel-ip-country` is client-spoofable off-Vercel. It is used to *deny* and to
  prefill, never as the sole authority to allow: the typed/stored country is validated
  independently, and the schema refinement runs on the server.
- The feedback route is reachable by URL; the bearer check is constant-time and runs
  before any database call.
- Feedback links carry an order-derived product slug and nothing else — no order number,
  no token, no email address in a query string. The comment form's own auth rules
  (`actions/comments.ts`) are untouched: this email grants no new posting ability.
- The new RPCs are `security definer` like their siblings and have `execute` revoked from
  `anon`/`authenticated`; the `"Order"` table gains no grant.
- No customer name, address, phone or email in any log line, in either the cron or the
  mailer.

## Acceptance criteria

1. A new order notification arrives from `orders@khemperfumes.com` with no cross-domain
   `Reply-To`, carries `X-Entity-Ref-ID`, and still shows order number, total, payment
   method/status, items, full address, contact and note.
2. A DELIVERED customer email contains no "have {amount} ready for the courier" sentence
   in either locale, while CONFIRMATION and SHIPPED on a cash order still do.
3. `npm run db:migrate` applies `0022` cleanly and is safe to re-run.
4. Twenty-four hours or more after an order reaches DELIVERED, the daily cron sends
   exactly one feedback letter, in the order's own locale, in the luxury shell, listing
   every purchased item; each linkable item is an anchor to
   `/{locale}/perfume|ritual/{slug}#comments`. Running the cron again sends nothing.
5. Following one of those links lands on the product page with the comment heading in
   view, not under the header.
6. From an Egyptian IP, checkout shows the country pre-filled and read-only and completes
   as before. From a non-Egyptian IP, the warning panel appears, the Place Order button is
   disabled, and a forced submit is refused by the action with the translated
   "we ship within Egypt only" message and no order row created.
7. With no geo header (local `npm run dev`), the country field is editable, defaults to
   Egypt, and an order places successfully.
8. `npm run lint` and `npm run typecheck` clean.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run db:migrate` (against the dev project)

## Exact manual test steps

**Delivered copy**
1. `npm run dev`, place a cash order, then in `/admin/orders` move it to DELIVERED.
2. Open the delivered email: the payment panel says "Cash on delivery" with **no** amount
   instruction. Re-check the confirmation email — the instruction is still there.
3. Repeat with an Arabic order (`/ar/checkout`) and confirm the same in Arabic.

**House notification**
4. Place any order; confirm the Resend dashboard shows the send from
   `orders@khemperfumes.com` with no `Reply-To`.
5. In Outlook, apply the safe-sender + rule steps handed back at the end, then place one
   more order and confirm it lands in the Inbox.

**Feedback email**
6. Mark an order DELIVERED, then back-date its DELIVERED event by 25 hours in Supabase
   SQL: `update "OrderStatusEvent" set "occurredAt" = now() - interval '25 hours' where "orderId" = '<id>' and status = 'DELIVERED';`
7. `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/order-feedback`
   → `{"sent":1}`. The letter arrives; each item links to its product's `#comments`.
8. Run the same curl again → `{"sent":0}`, no second letter.
9. Click one item link: the product page opens scrolled to "Reflections", the comment form
   visible and usable.

**Egypt-only checkout**
10. `npm run dev` → `/checkout`: country editable, "Egypt", order places. (No geo header
    locally — this is the fallback path.)
11. Restart with a stubbed header (temporary `x-vercel-ip-country: FR` via the proxy or a
    browser extension): the country field reads "France", read-only, the warning panel is
    shown, Place Order is disabled.
12. With that header still set, submit via devtools anyway (re-enable the button): the
    action refuses with the translated notice and `select count(*) from "Order"` is
    unchanged.
13. Set the header to `EG`: field reads "Egypt", read-only, order places normally.
14. Repeat 11–13 on `/ar/checkout` and confirm the notice is Arabic and right-aligned.
