# Customer Dashboard Consolidation — Rail, Bell, Profile, Vouchers Banner, Order Card

## Goal

Reshape the customer portal (`/[locale]/account/*`) so the rail carries four
entries only, notifications leave the rail for a header bell in the admin's
idiom, addresses and preferences fold into Profile, the overview opens on an
earned-vouchers banner above the two stat tiles, and the order card's tracker
becomes a quiet disclosure rather than an always-open rail.

Target rail, in order:

1. **Overview** — `/account`
2. **My Orders** — `/account/orders`
3. **Vouchers & Credits** — `/account/vouchers`
4. **Profile** — `/account/profile`

`Addresses`, `Preferences` and `Notifications` disappear from the rail.

## Skills read

None. This is storefront UI plus two Server Actions against tables that already
exist; `.agents/skills/clerk` and `.agents/skills/supabase` patterns are already
established in the files being edited and are followed, not re-derived. No AI
SDK surface is touched.

## Existing code inspected

- `src/app/[locale]/account/layout.tsx` — the gate; reads `unreadNotificationCount()` for the rail badge.
- `src/components/account/AccountSidebar.tsx` — seven-entry rail, client component, unread numeral.
- `src/app/[locale]/account/page.tsx` — overview: `StatGrid`, most-recent `OrderCard`, `MemberBenefits`.
- `src/app/[locale]/account/{orders,vouchers,profile,addresses,preferences,notifications}/page.tsx`
- `src/components/account/{StatGrid,OrderCard,OrderTracker,AddressCard,VoucherCard,CreditCard,CreditLedger,CreditSummary,MarketingPreference,NotificationList,AccountMenu,AccountIdentity}.tsx`
- `src/components/admin/NotificationBell.tsx` — the bell idiom to mirror: badge, pointerdown dismissal, Escape, `inert` panel, mark-read through an action then `router.refresh()`.
- `src/components/Nav.tsx` — header; `useAuth()` at line 274, `<AccountMenu />` at 628, mobile drawer branch at 838.
- `src/services/account.ts` — `getOrdersForUser`, `getAddressesForUser`, `getAccountSummary`.
- `src/services/{notifications,vouchers,credits}.ts` — `notificationsForUser`, `unreadNotificationCount`, `marketingOptInForUser`, `vouchersForUser`, `creditLedgerForUser`.
- `src/actions/notifications.ts` — customer `markNotificationsRead`; owner from `getUserId()`, never the payload.
- `src/lib/routes.ts` — `ACCOUNT_PATHS`.
- `src/lib/i18n/dictionaries/{en,ar}.ts` — the `account` block (en from line 1494).
- `supabase/sql/0024_customers.sql` — `"User"`, `"Address"`, `sync_clerk_user`.
- `supabase/sql/0016_checkout.sql` — `place_order`, and the `ship*` snapshot columns.

## Audit finding — why the test address was not saved

**There is no write path for `"Address"` anywhere in the application.**

- `supabase/sql/0024_customers.sql` creates the table, its indexes and the
  one-default-per-customer unique index. Nothing inserts into it.
- `grep '"Address"'` across `src/` returns exactly two query sites, both reads:
  `getAddressesForUser()` in `src/services/account.ts:142` and the admin
  customer detail read in `src/services/admin/customers.ts:158`.
- Checkout does **not** feed it. `place_order(payload)` writes
  `shipLine1 … shipCountry` denormalised onto `"Order"` — a snapshot of where
  one parcel went, deliberately immutable and deliberately not the address book
  (the comment at `0024_customers.sql:102` says so).
- `/account/addresses` never offered Add / Edit / Remove; its own file comment
  records that the controls were withheld until a Server Action existed.

So the address entered during the test was stored on the order and nowhere
else, and the panel correctly rendered its empty state. **Nothing is broken —
the feature was never built.** This prompt builds it.

Second finding, load-bearing for the fix: `"Address"."userId"` is a FK to
`"User"(id)`, and `"User"` rows arrive only from `sync_clerk_user` driven by the
Clerk webhook. A customer who signed up before the webhook existed (or whose
webhook delivery failed) has no `"User"` row, so any insert would fail on the
FK. The write path must therefore resolve-or-create that row first.

## Decisions and assumptions

1. **The bell overrides an earlier deliberate decision.** `AccountSidebar` and
   `notifications/page.tsx` both argue §16 ("optional and non-intrusive") means
   no bell in the storefront header. The user has asked for one; that is their
   call. The concession that keeps the spirit: the bell renders **only when
   signed in**, sits beside `<AccountMenu>` in the header, and is absent for
   every browsing visitor. Both file comments get rewritten to say what is now
   true rather than left contradicting the code.
2. **The bell must not make the site dynamic.** `Nav` is a client component in
   the root layout; reading the session where it renders would turn all thirty
   routes dynamic — the cost `src/actions/account.ts` documents at length. So
   the bell follows the `viewerIsAdmin()` precedent: a Server Action fetches the
   unread **count** once on mount when `isSignedIn`, and the full list when the
   panel is first opened. No count is server-rendered into the header.
3. **`/account/notifications`, `/account/addresses` and `/account/preferences`
   stay as routes.** Only the rail entries go. Deleting the routes would break
   the "Track your order" / unsubscribe links already sent in email and any
   bookmark, and `/account/notifications` is where the bell's "View all" lands.
   Addresses and Preferences routes become thin redirects to
   `/account/profile#addresses` / `#preferences` so no old link 404s.
4. **Profile becomes three stacked sections** on one route: Clerk's
   `<UserProfile />` first, then Addresses (`id="addresses"`), then Preferences
   (`id="preferences"`). Clerk keeps `routing="hash"`, so the two section ids
   must not collide with Clerk's own hash routes (`#/security` etc.) — they do
   not, since Clerk's begin with `#/`.
5. **The vouchers banner shows only what is real.** It renders the count and
   value of *available* credits plus *active* vouchers, read through the
   existing `creditLedgerForUser()` and `vouchersForUser()`. When a customer has
   neither, the banner is not rendered at all — no empty gold box, and no
   invented "0 vouchers" flourish.
6. **The tracker becomes a disclosure, not a removal.** The rail keeps every
   station and every stored date; it is simply collapsed behind a "Track order"
   trigger, with the current station named on the trigger so a collapsed card
   still answers "where is it".
7. **No new tables, no migration.** `"User"` and `"Address"` already carry every
   column needed.

## Files likely to change

**New**

- `src/components/account/NotificationBell.tsx` — client; storefront bell.
- `src/actions/account-notifications.ts` — `customerUnreadCount()`, `customerNotifications()`.
- `src/actions/addresses.ts` — `saveAddress`, `deleteAddress`, `setDefaultAddress`.
- `src/components/account/AddressBook.tsx` — client; list + add/edit form + delete/default controls.
- `src/components/account/AddressForm.tsx` — client; the form itself (may be folded into `AddressBook.tsx` if it stays under ~200 lines).
- `src/components/account/VoucherBanner.tsx` — the overview's earned-privileges banner.
- `src/schemas/address.ts` — Zod schema for the address payload.

**Edited**

- `src/components/account/AccountSidebar.tsx` — four entries; drop the unread numeral and the `unreadCount` prop.
- `src/app/[locale]/account/layout.tsx` — drop the `unreadNotificationCount()` read and the prop.
- `src/app/[locale]/account/page.tsx` — `<VoucherBanner>` above `<StatGrid>`.
- `src/app/[locale]/account/profile/page.tsx` — three sections; reads addresses + marketing opt-in.
- `src/app/[locale]/account/addresses/page.tsx` — redirect to `/account/profile#addresses`.
- `src/app/[locale]/account/preferences/page.tsx` — redirect to `/account/profile#preferences`.
- `src/components/account/OrderTracker.tsx` — disclosure wrapper (becomes a client component, or gains a client `<TrackerDisclosure>` sibling; prefer the sibling so the rail itself stays a Server Component).
- `src/components/account/OrderCard.tsx` — wrap the tracker in the trigger.
- `src/components/Nav.tsx` — `<NotificationBell />` beside `<AccountMenu>`, signed-in only, plus the mobile drawer branch.
- `src/services/account.ts` — `ensureUserRow(viewer)` helper for the FK, or a new `src/services/customers.ts` if `account.ts` grows past readability.
- `src/lib/i18n/dictionaries/en.ts` + `ar.ts` — new keys, matching shape in both.
- `src/types/account.ts` — `AddressInput` if the schema's inferred type is not enough.

## Implementation requirements

### 1. Rail

`AccountSidebar` renders exactly four links from `ACCOUNT_PATHS`:
`overview`, `orders`, `vouchers`, `profile`. Remove the `unreadCount` prop, the
`showCount` branch and the numeral. Remove the `unreadNotificationCount()` call
and its `Promise.all` slot from the layout. Update the file comment: the rail no
longer carries a count because the bell does. Keep the mobile horizontal strip,
the active-state border and `aria-current` exactly as they are.

### 2. Notification bell

`src/components/account/NotificationBell.tsx`, mirroring
`src/components/admin/NotificationBell.tsx`'s behaviour and *this* storefront's
tokens:

- Trigger: `<Bell size={15} strokeWidth={1.25} />`, ghost-styled to sit beside
  the cart and account buttons in `Nav` — no heavy border box; match the
  neighbouring header controls' padding and hover colour.
- Badge: gold dot with the unread count, `9+` above nine, `tabular-nums`,
  hidden entirely at zero.
- Panel: `role="dialog"`, `inert={!open}`, `aria-label` from the dictionary,
  dismissal on outside `pointerdown` and on Escape, opacity+translate transition
  at `duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`, `end-0` anchored so RTL
  flips correctly. Max height with internal scroll.
- Rows: kind icon (`Package` for `ORDER_STATUS`, `Wallet` for `CREDIT_EARNED`,
  `Ticket` for `VOUCHER_GRANTED`), the label as an LTR island (order numbers and
  voucher codes are Latin/numeric), relative time, unread tint.
- Footer: "View all" → `/account/notifications`.
- Data: `customerUnreadCount()` once on mount when `isSignedIn`;
  `customerNotifications()` on first open; opening a row calls the existing
  `markNotificationsRead` action then decrements locally and `router.refresh()`.
  A "Mark all as read" control in the panel header when unread > 0.
- Every string from `useDictionary()`. **No English literals** — the admin bell
  hardcodes its copy because the desk is English-only; this one is bilingual.
- Relative time must be locale-aware: use `Intl.RelativeTimeFormat` in the
  active locale rather than the admin bell's hand-rolled `ago()`.

`src/actions/account-notifications.ts`:

```ts
"use server";
export async function customerUnreadCount(): Promise<number>
export async function customerNotifications(): Promise<readonly CustomerNotification[]>
```

Both take **no arguments**. Identity comes from `getUserId()` / `getViewer()`
and nowhere else — a Server Action is a public endpoint, and one that accepted a
user id would answer questions about other people. Signed-out returns `0` / `[]`,
never an error.

In `Nav.tsx`, render the bell inside the existing `isSignedIn ?` branch, before
`<AccountMenu />`, and in the mobile drawer branch at ~line 838 render a plain
"Notifications" link with the count rather than a second popover.

### 3. Addresses → Profile, with a real write path

`src/schemas/address.ts` — `addressInputSchema`, mirroring the SQL checks
exactly so the database never rejects what the form accepted:

| field | rule |
|---|---|
| `id` | optional string — present means edit |
| `label` | 1–60 chars, trimmed, required |
| `recipient` | 2–120 chars |
| `line1` | 1–200 |
| `line2` | optional, ≤200, `""` → `null` |
| `city` | 1–80 |
| `state` | 1–80 |
| `postalCode` | 1–20 |
| `country` | 1–80 |
| `isDefault` | boolean, default `false` |

`src/actions/addresses.ts` — `"use server"`, three actions, each:

1. `const clerkUserId = await getUserId()`; null → `{ ok: false, error: … }`.
2. Parse the input with Zod; failure → field errors, never a throw.
3. Resolve the `"User"` row id for that `clerkId` **server-side**, creating it
   from the Clerk session (`getViewer()` gives email and name) when absent — the
   FK finding above. Never accept a `userId` from the caller.
4. Write through `getSupabaseAdmin()` (the public roles are revoked on
   `"Address"`, so the `userId` filter *is* the access control). Every
   update/delete carries `.eq("userId", resolvedId)` so a forged `id` from
   another customer's address touches nothing.
5. `revalidatePath` the profile route for both locales.

`isDefault` handling: the partial unique index allows one default per customer,
so promoting an address must clear the previous one. Do it as a two-statement
sequence — clear then set — and tolerate the race by retrying once on a
`23505`; do not add a trigger.

Deleting the default with other addresses remaining promotes the oldest
remaining one, so a customer is never left with an address book and no default.

`AddressBook.tsx` — client component:

- Renders the existing `<AddressCard>` grid, each card gaining Edit, Remove and
  (when not default) "Make default" controls in the house's ghost-link idiom.
- "Add address" opens an inline form below the grid (not a modal — the page is
  already a panel).
- `useTransition` for pending state; disable submit while pending; surface
  field-level errors returned by the action beneath their inputs in
  `text-danger`.
- Remove asks for confirmation inline (a second click on a "Confirm" state), not
  `window.confirm`.
- Inputs follow the project's existing form styling; find the closest existing
  form (`src/components/account/MarketingPreference.tsx`, the checkout form) and
  match it rather than inventing a new input treatment.

`profile/page.tsx` gains the two sections, each with a `<h2>` in
`font-heading text-base text-ground mb-6` and an anchor id, separated by the
same `mb-12 md:mb-16` rhythm the vouchers page uses. Preferences reuses
`<MarketingPreference>` and the language/currency note verbatim.

`addresses/page.tsx` and `preferences/page.tsx` become:

```ts
export default async function Page({ params }) {
  const { locale } = await params;
  redirect(localizePath(isLocale(locale) ? locale : "en", `${ACCOUNT_PATHS.profile}#addresses`));
}
```

Keep `generateMetadata` off these two — a redirect needs none.

### 4. Overview — earned-privileges banner

Above `<StatGrid>`, `<VoucherBanner>` reads the same two services the vouchers
panel does. It shows, on one line at `sm` and up:

- available KHEM credit — value (through `<Price>`, so the visitor's currency
  applies) and count;
- active vouchers — count, and the single best one's code + benefit when there
  is exactly one;
- a ghost link to `/account/vouchers`.

Treatment: a full-width band, `bg-stone` with a `border-s-2 border-gold` reading-
edge rule, a small `Ticket` glyph at `strokeWidth={1.25}`, numerals in
`font-heading text-ground-accent`, labels in `text-[11px] text-ground-muted`.
Elegant and flat — **no gradient, no glow, no shimmer, no animation on mount**.
It sits `mb-8` above the stat grid.

Render nothing at all when both lists are empty. The nearest expiring credit's
date, when one exists, appears as a quiet `text-[11px]` line ("Expires 12
March") — expiry is the one fact that changes what a customer does next.

### 5. Order card — simple tracker trigger

The rail's computation stays exactly where it is; only its presentation
changes. Add a client `<TrackerDisclosure>` that wraps `<OrderTracker>`:

- Collapsed by default. Trigger is a full-width row: "Track order" on the
  reading edge, the current station's name and a chevron on the far edge,
  `font-heading text-[10px] tracking-[0.16em] text-ground-muted`, hovering to
  `text-ground-accent`.
- `aria-expanded`, `aria-controls`, the panel `id`ed to match. Chevron rotates
  180° at `duration-300 ease-luxury-bezier`.
- Height animates via `grid-template-rows: 0fr → 1fr` (no `max-height` guess),
  or renders unanimated when `prefers-reduced-motion: reduce`.
- A halted order (`CANCELLED` / `REFUNDED`) starts **expanded** — that is the
  case where the customer most needs the detail, and hiding it reads as evasion.
- The overview's single recent order card behaves identically.

### 6. Dictionary

Every new string lands in `en.ts` and `ar.ts` with identical key shape; `ar` is
proper Arabic, not transliteration. New blocks: `account.bell.*`,
`account.vouchersBanner.*`, `account.orders.tracker.trigger` /
`.triggerCollapse`, `account.addresses.form.*` (labels, placeholders, errors,
`save`, `cancel`, `remove`, `confirmRemove`, `makeDefault`, `defaultBadge`,
`addAddress`, `emptyBody`), `account.profile.sections.{addresses,preferences}`.
Remove `account.nav.{addresses,notifications,preferences}` only if nothing else
reads them — the mobile drawer link and the two section headings likely still
do, so check before deleting.

## Security requirements

- Every new Server Action derives identity from `getUserId()` / `getViewer()`
  and **never** from an argument. No action accepts a user id, a Clerk id, or an
  email.
- `"Address"` writes go through `getSupabaseAdmin()` with `.eq("userId", …)` on
  every update and delete, where the id was resolved server-side from the
  session. A forged address `id` must affect zero rows, not another customer's.
- Zod-parse every payload before it reaches Supabase; reject rather than coerce.
- The `"User"` row created by the write path must never set `role` — that comes
  from Clerk and the allowlist, per `src/services/account.ts`'s closing note.
- `customerNotifications()` returns only the caller's feed; the existing
  `notificationsForUser({ clerkUserId, email })` shape is reused unchanged.
- The three panel routes keep `force-dynamic`, their `getViewer()` gate and
  `robots: { index: false, follow: false }`. The two redirect routes keep the
  gate implicitly through the layout.
- No secret ever crosses to the client: the bell receives its data from actions,
  never from a serialized server prop containing anything beyond the projection.

## Acceptance criteria

- [ ] The rail shows Overview, My Orders, Vouchers & Credits, Profile — and nothing else, at every breakpoint, in both locales.
- [ ] A signed-in visitor sees a bell in the header with a correct unread badge; a signed-out visitor sees no bell and triggers no action call.
- [ ] Opening a bell row marks it read, navigates to the right screen, and the badge falls on the next render.
- [ ] `/account/addresses` and `/account/preferences` redirect to the Profile sections; no 404, no broken email link.
- [ ] Profile renders Clerk's card, an Address Book, and Preferences, in that order, each reachable by hash.
- [ ] Adding an address from Profile stores a row in `"Address"` and it survives a reload — the audit finding is closed.
- [ ] Editing, removing, and promoting to default all persist; exactly one default exists at all times; removing the default promotes another.
- [ ] A customer with no `"User"` row can still save an address (the row is created).
- [ ] The overview shows the privileges banner when credits or vouchers exist, and renders nothing when neither does.
- [ ] The order card's tracker is collapsed with a "Track order" trigger naming the current station; cancelled/refunded orders open expanded.
- [ ] Zero `any`, zero new ESLint warnings, zero English literals in customer-facing components.
- [ ] RTL: banner, bell panel and disclosure all mirror correctly under `/ar`.

## Checks to run

```
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run dev`, sign in as a customer.
2. `/en/account` — confirm the rail has four entries; confirm the privileges
   banner appears above the stats only if that account holds a credit or
   voucher.
3. Header — confirm the bell, its badge count, the panel's outside-click and
   Escape dismissal, a row click marking read and navigating, and "Mark all as
   read".
4. Sign out — confirm the bell is gone.
5. `/en/account/addresses` — confirm the redirect to `/en/account/profile#addresses`.
6. On Profile, add an address: save, reload, confirm it is still listed. Edit
   it, reload. Add a second, make it default, confirm the first loses the badge.
   Remove the default, confirm the remaining one is promoted.
7. In Supabase, `select * from public."Address"` — confirm the rows, their
   `userId`, and that exactly one has `"isDefault" = true`.
8. `/en/account/orders` — confirm each card is collapsed with a "Track order"
   trigger naming the current station; expand one and confirm the rail and its
   dates are unchanged. Find or set a cancelled order and confirm it opens
   expanded.
9. Repeat 2, 3, 6 and 8 under `/ar/` — confirm mirroring, Arabic copy, Arabic
   dates, and that order numbers and voucher codes still read left-to-right.
10. Throttle to a 375px viewport and repeat 2, 3 and 6.
