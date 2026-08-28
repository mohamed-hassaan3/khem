We have finished the relevant planning and foundation work in `docs/customer-experiences` and `supabase/AGENTS.md`.

Now I want to implement the next customer-facing marketing and promotional experience for KHEM.

Before writing code:

1. Read and follow `supabase/AGENTS.md`.
2. Read all relevant files inside `docs/customer-experiences`.
3. Inspect the existing database schema, admin dashboard architecture, product/collection types, discount system, authentication, and existing UI components.
4. Reuse the existing architecture and conventions where appropriate.
5. Do not duplicate or conflict with the existing invitation-only/welcome discount system.
6. Give me a short implementation plan before making changes, then implement the work carefully.

---

# IMPORTANT: THESE ARE THREE DIFFERENT FEATURES

Please keep the following systems conceptually and technically separate:

### A. Customer subscription / special offer

This is for encouraging visitors to subscribe with their email and potentially earn a welcome discount.

### B. Announcement bar

This is for global marketing messages displayed throughout the website.

### C. Product and collection promotional discounts

This is for temporary commercial campaigns such as Black Friday, Ramadan, New Year, etc.

Do not mix promotional product discounts with invitation-only discounts, customer credits, or the existing welcome/invitation discount logic.

---

# FEATURE 1 — PREMIUM EMAIL SUBSCRIPTION / SPECIAL OFFER POPUP

I want a premium, luxury popup experience inspired by high-end fragrance brands such as Parfums de Marly and Xerjoff, but it must be an original KHEM design and not a copy.

## Customer experience

After a visitor spends some time browsing the KHEM website, show an elegant promotional popup.

The popup should NOT immediately appear aggressively when the website opens.

It should support configurable behavior such as:

* Delay before showing, for example 10–30 seconds.
* Optionally show after meaningful engagement.
* Do not repeatedly annoy the same visitor.
* Remember dismissal/subscription state appropriately.
* Do not show again immediately after the visitor closes it.
* Respect the existing cookie/privacy architecture.

## Popup visual design

The popup should feel:

* Ultra-premium.
* Luxury fragrance editorial.
* Elegant and minimal.
* Consistent with KHEM's brand identity.
* Suitable for desktop and mobile.

Desktop concept:

```text
┌──────────────────────────────────────────────┐
│                                              │
│               LIFESTYLE IMAGE                │
│                                              │
│                 KHEM VISUAL                  │
│                                              │
├───────────────────────┬──────────────────────┤
│                       │                      │
│      IMAGE /          │    SPECIAL OFFER    │
│      EDITORIAL        │                     │
│      VISUAL           │  Join the world of  │
│                       │       KHEM          │
│                       │                     │
│                       │  Subscribe and earn │
│                       │       XX% OFF       │
│                       │                     │
│                       │  [ Email Address ]  │
│                       │                     │
│                       │   [ JOIN KHEM ]     │
│                       │                     │
└───────────────────────┴──────────────────────┘
```

The exact layout can be improved creatively.

The popup should ideally have:

* One half premium KHEM campaign/lifestyle image.
* One half elegant content and email form.
* KHEM branding.
* A creative special offer message.
* Dynamic discount percentage.
* Email input.
* Clear CTA.
* Close button.
* Success state after subscribing.
* Validation and error states.

Mobile should be redesigned responsively rather than simply squeezing the desktop layout.

## Subscription logic

Use the architecture already documented in `docs/customer-experiences` and `supabase/AGENTS.md`.

The popup should integrate correctly with the existing customer/welcome offer system.

Important:

* Do not create a duplicate discount system.
* Do not automatically create insecure discounts in the frontend.
* The discount percentage and campaign configuration should come from the appropriate backend/database configuration.
* Handle existing subscribers/customers appropriately.
* Prevent abuse and duplicate submissions.
* The customer should receive the correct welcome/special offer according to the existing business rules.

Please inspect the existing implementation and recommend the correct behavior if there is ambiguity.

---

# FEATURE 2 — GLOBAL ANNOUNCEMENT BAR

Create a premium global announcement bar for the top of the KHEM website.

It should remain available consistently across the website according to the design.

The inspiration can be luxury e-commerce brands such as Parfums de Marly, but again create an original KHEM implementation.

Example messages:

* Complimentary shipping on selected orders.
* Subscribe and receive XX% off your first order.
* Discover the KHEM collection.
* Ramadan exclusive offer.
* Black Friday: Up to XX% off selected pieces.

The system must support multiple announcements.

## Display modes

I want an admin-configurable option for how announcements rotate.

Possible modes:

### 1. Static

Show one announcement only.

### 2. Infinite moving / marquee

Messages move continuously in an elegant way.

Important:

* Motion must be smooth.
* It should not feel cheap or distracting.
* Respect reduced-motion preferences where possible.
* Avoid performance issues.

### 3. Pagination / carousel

Example:

```text
Announcement 1
      ↓
wait 2 seconds
      ↓
Announcement 2
      ↓
wait 2 seconds
      ↓
Announcement 3
```

The interval should be configurable.

For example:

```text
Rotation interval:
2 seconds
3 seconds
5 seconds
```

Please implement the most appropriate architecture.

## Announcement fields

Create appropriate admin dashboard management for announcements.

Each announcement should support fields such as:

* Message.
* Arabic message.
* English message.
* Optional link.
* Optional CTA label.
* Active/inactive.
* Display order.
* Start date.
* End date.
* Display mode if needed.
* Optional priority.

Also ensure announcements can automatically become inactive outside their scheduled date range.

The website should only display currently active and valid announcements.

---

# FEATURE 3 — PRODUCT AND COLLECTION PROMOTIONAL DISCOUNTS

This is separate from:

* Invitation-only discounts.
* Welcome discounts.
* Customer-specific discounts.
* Customer credits.

I need a dedicated promotional pricing system for products and collections.

This is for campaigns such as:

* Black Friday.
* New Year.
* Ramadan.
* Eid.
* Seasonal sales.
* Limited-time campaigns.

## Example

Normal product:

```text
1,800 EGP
```

During a promotion:

```text
1,800 EGP   ← old price
1,440 EGP   ← discounted price
```

The old price should appear elegantly, with appropriate styling such as a subtle strikethrough.

The discounted price should remain visually premium and consistent with KHEM.

Do not make it look like a cheap marketplace sale.

---

# ADMIN DASHBOARD — PROMOTIONAL PRICING

I need an easy way in the admin dashboard to create and manage promotional discounts.

Please inspect the current product and collection architecture before deciding the exact UI.

I want the system to support discounts by:

### Percentage

Example:

```text
20% OFF
```

### Fixed amount

Example:

```text
500 EGP OFF
```

The promotional discount should potentially be applicable to:

* A specific product.
* Multiple selected products.
* A collection.
* Multiple selected collections.

Please recommend the cleanest data model based on the current schema.

---

# PROMOTION CONFIGURATION

Each promotional campaign should ideally support:

* Promotion name.
* Internal/admin description.
* Discount type.

  * Percentage.
  * Fixed amount.
* Discount value.
* Target type.

  * Product.
  * Collection.
* Selected targets.
* Start date/time.
* End date/time.
* Active/inactive status.
* Optional campaign label.

Examples:

```text
BLACK FRIDAY
20% OFF
```

```text
RAMADAN OFFER
15% OFF SELECTED COLLECTIONS
```

The discount should automatically become active and inactive based on the configured dates.

---

# PRICING RULES

Please carefully design the pricing logic.

The frontend must never be the source of truth for calculating final prices.

Pricing must be calculated safely from trusted data.

We need to clearly handle situations such as:

* Product belongs to a discounted collection.
* Product has its own promotional discount.
* Multiple promotions overlap.
* Welcome discount exists.
* Customer-specific offer exists.
* Customer credit exists.

Please inspect the existing customer-experience and discount documentation and propose a clear priority rule.

For example, do not accidentally stack multiple discounts unless stacking is explicitly allowed.

I prefer a predictable and safe system.

Please document the chosen rule.

---

# PRODUCT CARD UI

Update product cards to elegantly display promotional pricing.

Example:

```text
KHEM SIGNATURE
IVORY TEMPLE

1,800 EGP
1,440 EGP

[ VIEW PRODUCT ]
```

The design should be:

* Minimal.
* Luxury.
* Elegant.
* Clear.
* Not overly promotional.
* Consistent with KHEM's premium positioning.

Potential elements:

* Subtle campaign label.
* Small "20% OFF" indicator where appropriate.
* Elegant old price.
* Prominent but tasteful new price.

Do not overuse red sale badges or aggressive e-commerce visuals unless they fit the final KHEM creative direction.

---

# PRODUCT DETAIL PAGE

The same pricing logic must appear consistently on the product page.

Show:

* Original price when applicable.
* Promotional price.
* Promotion information where appropriate.
* Correct final price.
* Clear customer understanding.

---

# COLLECTION PAGES

If a collection is under a promotion:

* Products should display their correct discounted price.
* The collection page may display a tasteful campaign message.
* The promotion should not break individual product pricing rules.

---

# TECHNICAL REQUIREMENTS

Please ensure:

## Security

* Sensitive calculations are not trusted from the client.
* Admin actions require proper authorization.
* Normal customers cannot create or modify promotions.
* Supabase security and RLS follow `supabase/AGENTS.md`.
* No service-role secrets are exposed to the client.

## Database

Before changing the schema:

1. Inspect existing discount and pricing tables.
2. Avoid unnecessary duplicate tables.
3. Reuse existing architecture where possible.
4. If schema changes are required, explain them clearly.
5. Add migrations according to the project's conventions.

## Type safety

* Update TypeScript types.
* Avoid `any`.
* Keep database and application types synchronized.

## Localization

KHEM supports English and Arabic.

Ensure:

* Popup content supports localization.
* Announcement messages support localization.
* Promotional labels can support localization where necessary.
* RTL layout works correctly.
* Arabic text does not become empty or fall back incorrectly.

## Performance

* Avoid unnecessary database requests.
* Cache or fetch global announcements appropriately.
* Do not make the popup negatively affect page performance.
* Avoid layout shift.

## Accessibility

* Popup must have proper focus handling.
* Escape key should close the modal.
* Screen-reader support should be considered.
* Reduced-motion preferences should be respected.
* Announcement movement should not create accessibility problems.

---

# EXPECTED IMPLEMENTATION PROCESS

Please work in this order:

## Phase 1 — Investigation

Inspect:

* `supabase/AGENTS.md`
* `docs/customer-experiences`
* Existing discount system.
* Existing customer tables.
* Existing products and collections.
* Admin dashboard architecture.
* Current authentication and authorization.
* Existing UI components.

Then summarize what already exists.

---

## Phase 2 — Architecture

Explain:

1. What will be reused.
2. What new database changes are required.
3. Whether promotional discounts should use an existing table or a new promotion system.
4. How pricing priority will work.
5. How subscription/welcome offers connect with the existing system.
6. How announcement data will be stored.

Wait for my confirmation before making destructive schema changes.

---

## Phase 3 — Database and backend

Implement the approved database and server-side logic.

---

## Phase 4 — Admin dashboard

Implement:

### Subscription popup configuration

Where appropriate.

### Announcement management

Including:

* Create.
* Edit.
* Activate/deactivate.
* Scheduling.
* Ordering.
* Rotation settings.

### Promotional pricing management

Including:

* Campaign creation.
* Product targeting.
* Collection targeting.
* Percentage/fixed discounts.
* Start/end dates.
* Activation.

---

## Phase 5 — Customer UI

Implement:

1. Premium subscription popup.
2. Global announcement bar.
3. Elegant promotional product pricing.
4. Product page promotional pricing.
5. Collection promotional experiences.

---

# FINAL REVIEW

After implementation, provide:

1. Files created.
2. Files modified.
3. Database changes.
4. How the three systems are separated.
5. Pricing priority rules.
6. Security measures.
7. Admin instructions.
8. Customer experience flow.
9. Any recommended future improvements.

Do not make unnecessary changes outside this scope.

The final result should feel like a premium, international luxury fragrance brand while remaining uniquely KHEM.
