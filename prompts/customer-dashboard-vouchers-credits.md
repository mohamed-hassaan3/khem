# Customer Dashboard, KHEM Account Menu, and My Vouchers & Credits (Priority 1)

## Goal

Deliver **Priority 1** of `src/docs/customer-experience.md`:

1. Replace Clerk's `<UserButton>` popover in the header with a minimal, house-branded
   KHEM account menu — name, email, **Dashboard**, **Sign Out** — with no "Manage
   account" row, no "Secured by Clerk" badge, and no "Development mode" footer.
2. Make the existing `/account` portal the **Customer Dashboard**, with a navigation
   rail covering Overview, Profile, Orders, Addresses, Vouchers & Credits,
   Notifications, Preferences.
3. Build **My Vouchers & Credits** on the *existing* database foundation:
   credit balance, credit transaction history, available vouchers, voucher
   status/expiry, copy-code.

Wishlist is out of scope and stays removed. Priority 2–6 are not started here.

## Skills read

- `AGENTS.md` (root) — §1 operating rules, §2 workflow, §3 design system, §6 stack,
  §8 routing matrix, §11 component standards, §12 checklist.
- `src/docs/customer-experience.md` — §3 account experience, §4 vouchers & credits,
  §19 Priority 1, §20 technical rules.
- `supabase/AGENTS.md` conventions as referenced by the migration headers below.
- No new external skill is needed: this is repository-pattern work (Next.js App
  Router, Clerk, Supabase secret-key reads, Tailwind v4 tokens).

## Existing code inspected

**Account portal**
- `src/app/[locale]/account/layout.tsx` — the portal shell and the auth gate
  (`getViewer()`, locale-aware redirect); renders `AccountIdentity` + `AccountSidebar`.
- `src/app/[locale]/account/page.tsx` (overview), `orders/page.tsx`,
  `addresses/page.tsx`, `profile/page.tsx` (Clerk `<UserProfile routing="hash">`).
- `src/components/account/*` — `AccountSidebar` (client, `usePathname`),
  `AccountIdentity`, `StatGrid`, `OrderCard`, `MemberBenefits`, `SignOutButton`.
- `src/lib/routes.ts` — `ACCOUNT_PATHS`, `ADMIN_PATH`, `AUTH_PATHS`.
- `src/lib/auth.ts` — `getViewer()` / `Viewer`; `src/lib/admin/auth.ts` — email allowlist.

**Header**
- `src/components/Nav.tsx:495` — `<UserButton userProfileMode="navigation" …>` inside
  the signed-in branch; signed-out branch is a `<Link>` to `signInPathWithReturn`.
- `src/lib/clerk-appearance.ts` — the shared Clerk theme; its `options` comment records
  that removing the "secured by Clerk" badge is a paid-plan feature.

**Credits (Discovery Credits)**
- `supabase/sql/0026_discovery_credits.sql` — `customer_credits`, `credit_transactions`,
  `credit_balances` view. RLS on, **no policy, no grant to public roles** — reads must
  use `getSupabaseAdmin()` and filter by a server-verified `clerkUserId`.
- `supabase/sql/0027_credit_redemption.sql` — `place_order()` spends a credit; a listed
  credit is a suggestion, never a permission.
- `src/services/credits.ts` — `creditsForUser()`, `spendableCreditsForUser()`.
- `src/services/admin/credits.ts` — `getCredit()` shows the transaction-trail read shape
  to copy (`credit_transactions` by `creditId`, ascending).
- `src/types/credit.ts`, `src/schemas/db/credits.ts` — `Credit`, `CreditTransaction`,
  `CreditStatus`, column lists, Zod row parsers.

**Vouchers (discount engine)**
- `supabase/sql/0028_discounts.sql` — `discounts`, `discount_grants`,
  `discount_redemptions`, `resolve_discount()`. Same trust posture: secret key only.
- `src/types/discount.ts`, `src/schemas/db/discounts.ts`, `src/services/admin/discounts.ts`.

**Shared**
- `src/lib/i18n/dictionaries/en.ts` (the `Dictionary` shape) and `ar.ts` (typed against it,
  so every new key must be translated or the build fails).
- `src/lib/format.ts` (`formatPrice`), `src/providers/currency-provider.tsx`
  (`useFormatPrice`), `src/lib/i18n/rtl.ts` (`ltrIsland`), `src/components/ecommerce/EmptyState.tsx`.

## Decisions and assumptions

1. **The header menu is hand-rolled, not a themed `<UserButton>`.** Hiding Clerk's
   footer with CSS is exactly what `clerk-appearance.ts` warns breaks on a Clerk
   release, and "Manage account" cannot be removed from the popover. A small KHEM
   `<AccountMenu>` client component (avatar trigger + popover) removes all three
   pieces of third-party chrome by not rendering them. Clerk keeps ownership of
   identity: the menu reads `useUser()` and signs out with `useClerk().signOut()`,
   and `/account/profile` still renders Clerk's `<UserProfile>`.
   `khemClerkAppearance` is left untouched — `<SignIn>`, `<SignUp>` and
   `<UserProfile>` still use it.
2. **No admin branch in the header menu.** Doc §3.3 (admin menu) is not in Priority 1,
   and deriving admin status in the header would mean reading `currentUser()` in the
   root layout, which the layout's own comment says turns all ~30 routes dynamic.
   Admins reach `/admin` through the existing dashboard shell. Flagged below.
3. **"KHEM Credit" is the Discovery Credit ledger, and the copy must say so.** A credit
   is consumed **whole** against one eligible fragrance and has no cash value
   (0026 policy 4–7). The panel therefore shows each credit as a card with its own
   face value, status and expiry, plus a headline "available" total — it does **not**
   present a spendable wallet balance, which would misdescribe the instrument.
4. **A customer's vouchers are their `discount_grants`.** Grant rows are the only
   per-customer entitlement in the schema; public campaign codes are not personal
   privileges and listing them would leak every active code to every signed-in
   visitor. Grants are matched by `clerkUserId` **or** lowercased verified email
   (0028 stores grants by email and back-fills `clerkUserId`).
5. **Voucher status is derived, never stored** — same discipline as `credit_balances`.
   Order of precedence: `USED` → `EXPIRED` (grant or discount window) → `UNAVAILABLE`
   (discount inactive) → `SCHEDULED` (`startsAt` in the future) → `AVAILABLE`.
   Derivation lives in one server module so the panel cannot disagree with
   `resolve_discount()` about what "available" means.
6. **Notifications and Preferences ship as real routes with honest empty states.**
   The nav is requested in Priority 1 but the features are Priority 5. Each panel
   states plainly that there is nothing yet rather than faking data. No new table.
7. **Money and dates**: piastres throughout, formatted at the edge — `useFormatPrice()`
   for amounts (per-visitor currency), a locale-aware date formatter for dates,
   `ltrIsland()` for codes and emails in the Arabic tree.
8. **`/account/vouchers`** is the path (short, stable); the nav label is
   "Vouchers & Credits".

## Files likely to change

**New**
- `src/app/[locale]/account/vouchers/page.tsx` — the panel (force-dynamic, gated).
- `src/app/[locale]/account/notifications/page.tsx` — placeholder panel.
- `src/app/[locale]/account/preferences/page.tsx` — placeholder panel.
- `src/services/vouchers.ts` — `vouchersForUser({ clerkUserId, email })`, server-only.
- `src/services/credits.ts` — extended with `creditLedgerForUser()` (credits +
  their transactions, one round trip per table).
- `src/types/voucher.ts` — `CustomerVoucher`, `VoucherStatus`.
- `src/schemas/db/vouchers.ts` — grant+discount row parser (or extend
  `schemas/db/discounts.ts` if the joined shape fits there).
- `src/components/account/CreditSummary.tsx` — headline available total (client, currency).
- `src/components/account/CreditCard.tsx` — one credit: value, status, expiry.
- `src/components/account/CreditLedger.tsx` — date / description / type / amount table.
- `src/components/account/VoucherCard.tsx` — code, value, minimum, expiry, status, copy.
- `src/components/account/CopyCodeButton.tsx` — clipboard + transient confirmation.

**Modified**
- `src/components/Nav.tsx` — swap `<UserButton>` for `<AccountMenu>`.
- `src/components/account/AccountMenu.tsx` — new, but lives beside its siblings.
- `src/components/account/AccountSidebar.tsx` — three new links.
- `src/lib/routes.ts` — `ACCOUNT_PATHS.vouchers | notifications | preferences`.
- `src/lib/i18n/dictionaries/en.ts` + `ar.ts` — new `account.vouchers`,
  `account.notifications`, `account.preferences`, `account.nav.*`, `nav.dashboard` keys.
- `src/app/[locale]/account/page.tsx` — overview gains a credit/voucher teaser only if
  it stays honest (a count, linking to the panel); no new invented stats.

## Implementation requirements

**Header menu**
- Trigger: the existing 26px avatar box (Clerk `imageUrl`, else the gold initial disc),
  `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`.
- Popover: obsidian surface, `backdrop-blur-md`, hairline `border-border`, 2px radius,
  Cinzel labels at `text-[11px] tracking-[0.12em]`, gold on hover, 300–400ms
  `ease-luxury-bezier` fade+2px rise. No spring, no bounce.
- Contents, in order: name (or email when unnamed), email (LTR island), hairline rule,
  **Dashboard** → `localizePath(locale, ACCOUNT_PATHS.overview)`, hairline rule,
  **Sign Out** → `signOut({ redirectUrl: localizePath(locale, "/") })`.
- Closes on outside pointerdown, `Escape` (returning focus to the trigger), route
  change, and menu-item activation. Arrow-key roving focus between items.
- RTL: anchored with logical properties (`end-0`), never `right-0`.
- While Clerk is still resolving, the signed-out `<Link>` renders exactly as today so
  the header cannot collapse mid-hydration.

**Dashboard shell**
- `AccountSidebar` link table extended in this order: Overview, Profile, My Orders,
  Addresses, Vouchers & Credits, Notifications, Preferences. Active state and the
  mobile horizontal strip behaviour are unchanged.
- Each new page: `export const dynamic = "force-dynamic"`, `generateMetadata` with
  `robots: { index: false, follow: false }`, and its own `getViewer()` gate with
  `signInPathWithReturn` — matching the existing panels exactly.

**Vouchers & Credits panel**
- Sections, top to bottom: KHEM Credit (headline + credit cards) → Credit Activity
  (ledger) → My Vouchers (cards, available first) → nothing else.
- Credit card: face value, status chip, "Available until {date}" / "Available once your
  Discovery Set is delivered" / "Expired" / "Redeemed" / "Cancelled", and the source
  order number where one is available.
- Ledger row: date, description (derived from `kind` + `note` + order number), type
  chip, signed amount — `+` in gold for EARNED/REFUNDED/ADJUSTED-positive, `−` in
  muted ivory for USED/EXPIRED. Wide table scrolls inside its own container.
- Voucher card: code (uppercase, LTR island, tracking-widest), the benefit
  ("15% OFF" / a fixed amount), minimum order when non-zero, expiry when set, status
  chip, and **Copy Code** — which writes to the clipboard and shows "Voucher code
  copied." for ~2s with `aria-live="polite"`. Non-available vouchers are visibly
  dimmed and their copy button is disabled, so no invalid code reads as active.
- Empty states use `<EmptyState>` with house copy, not a bare "no data" line.

**Notifications / Preferences**
- One honest panel each: eyebrow, heading, and a bordered note explaining that the
  house will place order updates and privileges here / that language, currency and
  marketing choices arrive with the next phase. No fake toggles.

## Security requirements

- `clerkUserId` and email come **only** from `getViewer()` / `currentUser()` on the
  server — never a route param, search param, form field, or client prop.
- Every new service module starts with `import "server-only"` and reads through
  `getSupabaseAdmin()`; the `.eq("clerkUserId", …)` / grant-identity filter **is** the
  access control, because 0026 and 0028 grant the public roles nothing.
- No new SQL, no new table, no policy change, no RLS relaxation in this phase.
- Rows are Zod-parsed, never asserted; a malformed row is dropped, not rendered.
- Nothing on these pages computes or exposes a price the checkout would trust —
  voucher amounts shown are the *rule* (15%, EGP 200 off), not a resolved order
  discount. `resolve_discount()` remains the only place an amount is computed.
- New pages are `noindex, nofollow`; the account layout gate stays as-is.
- No credit or voucher identifier is written into a query string.

## Acceptance criteria

- [ ] Signed-in header avatar opens a KHEM menu showing name + email, Dashboard, Sign Out.
- [ ] No "Manage account", no "Secured by Clerk", no "Development mode" anywhere in
      the header menu.
- [ ] Sign Out ends the session and lands on `/` or `/ar` per the active locale.
- [ ] `/account` rail lists all seven sections; each resolves, gates, and marks itself
      active correctly at `/` and `/ar/`.
- [ ] `/account/vouchers` shows the customer's own credits, ledger and vouchers, and
      nobody else's.
- [ ] Voucher status is correct for used, expired, scheduled, inactive and available
      rows; only available ones can be copied.
- [ ] Copy Code copies the exact stored code and confirms it.
- [ ] Empty account (no credits, no vouchers) renders composed empty states, not blanks.
- [ ] `npx tsc --noEmit` and `npm run lint` are clean; `ar.ts` compiles, meaning every
      new key is translated.
- [ ] No horizontal page scroll at 320px; RTL layout mirrors correctly.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build      # if it completes in a reasonable time on this machine
```

There is no test suite in `package.json`; verification is type-check, lint, build,
and the manual steps below.

## Manual test steps

1. `npm run dev`.
2. Signed out: header shows the account icon; clicking it goes to `/sign-in` with the
   return path attached.
3. Sign in. Click the avatar — confirm name, email, Dashboard, Sign Out, and the
   absence of Clerk chrome. Press `Escape` (menu closes, focus returns to the avatar),
   reopen, click outside (closes), reopen and arrow through the items.
4. Click **Dashboard** → `/account`. Walk all seven rail sections; confirm the active
   marker and that each panel loads.
5. `/account/vouchers` on an account with no credits and no grants → both empty states.
6. In `/admin/credits`, adjust or issue a credit for the signed-in account (or seed a
   Discovery Set order through the existing flow), reload → the credit card, its status
   and a ledger row appear with the right sign and amount.
7. In `/admin/discounts`, create a grant-gated code granted to the signed-in account's
   email; reload `/account/vouchers` → the voucher appears as Available with its
   benefit, minimum and expiry. Copy the code and paste it — it matches exactly.
8. Deactivate that discount, and separately set `endsAt` in the past → the card shows
   Unavailable / Expired, dimmed, copy disabled.
9. Repeat 4–7 under `/ar/account/vouchers`: Arabic copy, mirrored layout, codes and
   emails still reading left-to-right.
10. At 320px width, confirm the rail strip scrolls and the ledger table scrolls inside
    its own container rather than the page.

## Open questions for the user

1. **Admin account menu (doc §3.3)** is deferred — reason in decision 2. Confirm, or
   accept a `/api/account/role` lookup fetched when the menu opens.
2. **Public campaign codes** are deliberately not listed as personal vouchers
   (decision 4). Confirm.
3. **Notifications / Preferences** ship as honest placeholder panels this phase
   (decision 6). Confirm, or drop them from the rail until Priority 5.
