# Stage 1 — Account dashboard: compact, mobile-first

Part of `prompts/mobile-ux-audit-and-plan.md` (findings A1–A10).

## Goal

Make `/account` and its panels (overview, orders, vouchers & credits, profile,
notifications) show **more useful information per phone screen with less empty
bulk**, while still reading as KHEM. On a 390×844 phone:

- the overview shows the greeting, both stats, the privilege band (when
  present) and the top of the latest order **within about two screens**,
  instead of about four today;
- no account content scrolls sideways (ledgers, Clerk card);
- an empty panel is about one screen tall, not more;
- every profile section can be reached in one tap from the top of the page.

Desktop (`lg+`) keeps its composition: the 280px rail with the identity block
and the panel column. It only picks up the tighter internals where they are
shared.

## Skills read

- `AGENTS.md` §2.2, §3, §8 (account is `force-dynamic`), §10.2 (Clerk provider
  only on account/auth; **never `prefetchUI={false}`**).
- `.agents/skills/clerk/SKILL.md`: **re-read before touching the
  `<UserProfile>` appearance**. Use only appearance element keys the installed
  `@clerk/nextjs` version documents. Do not invent keys.
- `node_modules/next/dist/docs/` is not needed: no routing, data or boundary
  changes.

## Existing code inspected

- `src/app/[locale]/account/layout.tsx`: shell. Rail `<aside>` sticky strip
  below `lg`; `AccountIdentity` is `hidden lg:block`; `<main>` is
  `px-5 pb-14 pt-10`; a bell-only row `mb-6 md:mb-8`; mobile sign-out
  `mt-10 pt-8`.
- `src/app/[locale]/account/{page,orders/page,vouchers/page,profile/page,notifications/page}.tsx`:
  each repeats `eyebrow mb-3` + `h1 mb-8 md:mb-12 text-3xl sm:text-4xl`
  (overview adds `lg:text-5xl`).
- `src/components/account/StatGrid.tsx`: `grid-cols-1 sm:grid-cols-2`,
  `px-8 py-9`, `text-3xl`, `mb-15`.
- `PrivilegeBanner.tsx` (`px-6 py-6 mb-8`, `gap-x-12`, `text-2xl`),
  `MemberBenefits.tsx` (`px-8 py-6`).
- `OrderCard.tsx`: `p-8`, `grid-cols-1 sm:grid-cols-[1fr_auto]`, tracker block
  `mt-8 pt-6`; `TrackerDisclosure.tsx` inner `pt-8`.
- `CreditLedger.tsx` / `RewardLedger.tsx`: `<table min-w-[34rem]>` in
  `overflow-x-auto`.
- `CreditSummary.tsx` / `RewardSummary.tsx`: `px-6 py-8`, `text-4xl`.
- `CreditCard.tsx`, `VoucherCard.tsx`, `AddressCard.tsx` (`p-9`),
  `AddressBook.tsx` (form `px-6 py-7`, `gap-y-4`, actions `mt-8`),
  `MarketingPreference.tsx` (`px-6 py-6`), `NotificationList.tsx` (rows
  `px-5 py-5`), `NotificationBell.tsx` (popover `w-[min(88vw,23rem)]`).
- `AccountSidebar.tsx`: tab strip `py-3`, links `px-4 py-3.5`.
- `AccountIdentity.tsx`: Server Component, 56px avatar, `px-9 pb-9`.
- `src/components/ecommerce/EmptyState.tsx`: `min-h-[60vh] py-14 md:py-24`,
  used by 9 files (storefront and account).
- `src/lib/clerk-appearance.ts`: `khemClerkAppearance` (shared by sign-in/up
  and `<UserProfile>`).
- Dictionary: `dict.account.profile.sections.{account,addresses,preferences}`
  already exists, so the profile jump row needs **no new copy**.

## Decisions / assumptions

1. **No new copy and no new data.** Everything uses existing dictionary keys
   and existing service reads. No overview shortcut tiles: the rail already
   does that job, and a second set of links would be duplication.
2. **One shared header component**, `AccountPageHeader` (Server Component,
   `{ eyebrow, heading }`), replacing the five copies. Phone: `text-2xl`,
   `mb-5`. `sm:text-3xl`, `lg:text-4xl`, `md:mb-10`. Overview keeps its
   larger desktop size via an optional `size="display"` (`lg:text-5xl`).
3. **Identity on phones, without extra height:** the bell row becomes a
   phone-only identity row: 32px avatar/initial + name (or email when there is
   no name), truncated, with the bell at the end. `AccountIdentity` gains a
   `variant: "rail" | "inline"` prop and stays a Server Component. The row is
   `lg:hidden` for identity; on `lg` the row keeps only the bell, as today.
4. **Ledgers:** one component still renders both shapes: a stacked `<ul>` list
   `sm:hidden`, and the existing table `hidden sm:block`. This duplicates markup
   that is server-rendered and small (one customer's rows), which is cheaper
   and more robust than CSS-table hacks. Each row shows date + description on
   top and the signed amount at the end, with the status chip under the
   description.
5. **`EmptyState` gets `compact?: boolean`**: no `min-h`, `py-10`, icon 40px,
   `text-xl` heading, `mb-6` body. Default stays exactly as it is, so the
   storefront is unchanged. Account panels pass `compact`.
6. **Clerk `<UserProfile>`:** add a **profile-scoped** appearance (passed as
   the `appearance` prop on `<UserProfile>` only, so sign-in/up stay as they
   are). Root and card take the column width with no shadow or outer frame, and
   inner page padding drops to phone scale. Remove the `overflow-x-auto`
   wrapper once it fits. Element keys come from the Clerk skill/docs; if a key
   can't be confirmed, leave that part out and keep the wrapper.
7. **Logical properties only** (`ps/pe/ms/me/start/end`); numbers, amounts,
   order numbers, emails and codes stay inside `ltrIsland(locale)`, as they are
   today.
8. No motion changes in this stage (stage 4). Existing transitions stay as they
   are.

## Files likely to change

- `src/app/[locale]/account/layout.tsx`
- `src/app/[locale]/account/page.tsx`, `orders/page.tsx`, `vouchers/page.tsx`,
  `profile/page.tsx`, `notifications/page.tsx`
- `src/components/account/AccountPageHeader.tsx` (**new**)
- `src/components/account/AccountIdentity.tsx`
- `src/components/account/AccountSidebar.tsx`
- `src/components/account/StatGrid.tsx`, `PrivilegeBanner.tsx`, `MemberBenefits.tsx`
- `src/components/account/OrderCard.tsx`, `TrackerDisclosure.tsx`
- `src/components/account/CreditLedger.tsx`, `RewardLedger.tsx`
- `src/components/account/CreditSummary.tsx`, `RewardSummary.tsx`, `CreditCard.tsx`, `VoucherCard.tsx`
- `src/components/account/AddressCard.tsx`, `AddressBook.tsx`
- `src/components/account/MarketingPreference.tsx`, `NotificationList.tsx`
- `src/components/ecommerce/EmptyState.tsx` (additive `compact` prop)
- `src/lib/clerk-appearance.ts` (new exported `khemUserProfileAppearance`, additive)

## Implementation requirements

### Shell (`account/layout.tsx`, `AccountSidebar.tsx`)
- `<main>`: `px-4 pb-10 pt-4 sm:px-8 sm:pt-8 lg:px-20 lg:pt-15`
  (desktop unchanged).
- Top row: `mb-5 md:mb-8 flex items-center gap-3`. Start: inline identity
  (`lg:hidden`). End (`ms-auto`): bell.
- Rail strip below `lg`: nav `py-1 px-2`, links `px-3.5 py-3` (44px+ target
  kept), `scroll-px-2 snap-x` with `snap-start` on links. `lg:` classes are
  unchanged.
- Mobile sign-out block: `mt-8 pt-6`.

### `AccountIdentity` (`variant="inline"`)
- `flex min-w-0 items-center gap-3`; avatar/initial `size-8`; name
  `font-heading text-[13px] truncate`; email `text-[11px] truncate` LTR island
  under the name **only when a name exists** (otherwise the email is the single
  line). No border or padding. `variant="rail"` renders exactly what it renders
  today.

### `AccountPageHeader` (new, used by all five panels)
- `<header className="mb-5 md:mb-10">`, eyebrow `mb-2 md:mb-3`, h1
  `font-heading font-normal text-ground text-2xl sm:text-3xl lg:text-4xl`
  (`display`: add `lg:text-5xl`). Leading `leading-tight`.

### Overview
- `StatGrid`: `grid grid-cols-2 gap-px mb-6 md:mb-12`; tile
  `bg-stone px-4 py-4 sm:px-8 sm:py-8`; value `text-xl sm:text-3xl`
  `tabular-nums`, with `break-words` so long currency amounts wrap instead of
  overflowing; label `text-[12px] sm:text-[13px]`; the "all time" sub-line
  stays.
- `PrivilegeBanner`: `mb-5 md:mb-8 px-4 py-4 sm:px-8 sm:py-7`; eyebrow `mb-3`;
  values `text-xl sm:text-3xl`; `gap-x-8 gap-y-4 sm:gap-x-12`; the "View" link
  stays at the end of the row and wraps under the figures on narrow screens.
- Recent order section: `mb-6 md:mb-10`, heading row `mb-3 md:mb-6`.
- `MemberBenefits`: `px-4 py-4 sm:px-8 sm:py-6`.

### Orders (`OrderCard`, `TrackerDisclosure`)
- Card `p-4 sm:p-8`.
- Grid `grid-cols-[1fr_auto]` at **every** width (total stays beside the order
  number); total `text-base sm:text-xl`.
- Number/status row `gap-x-3 gap-y-1.5 mb-2`; items line `line-clamp-2`
  (full text in `title`); date and tracking on one wrapping line separated by
  `·`.
- Tracker block `mt-4 pt-3 sm:mt-8 sm:pt-6`; disclosure inner `pt-5 sm:pt-8`.
- Orders list gap `gap-2`.

### Vouchers & credits
- Section `mb-10 md:mb-16`; h2 `mb-3 md:mb-6`; summary wrappers `mb-5 md:mb-8`.
- `CreditSummary` / `RewardSummary`: `px-4 py-5 sm:px-10 sm:py-10`; balance
  `text-3xl sm:text-5xl`; explanatory paragraph `text-[12px]` with `mb-3`
  spacing above.
- `CreditCard` / `VoucherCard`: padding `p-4 sm:p-6` (match existing desktop
  values when they are smaller); grid gap `gap-2 sm:gap-4`.
- Ledgers: phone list as described in Decision 4. Row `px-4 py-3`,
  `border-b border-ground-border`, date `text-[11px] text-ground-muted`,
  description `text-[12px]` `dir="auto"`, amount `font-heading text-[13px]`
  LTR island with the same sign and colour logic as the table cell (reuse the
  existing helper or expression; do not reimplement it differently).
- Empty states: `compact`.

### Profile
- Under the header, a jump row: `<nav aria-label={copy.heading}>` with three
  anchor links (`#details`, `#addresses`, `#preferences`) labelled from
  `copy.sections.*`, styled like the rail tabs at `text-[11px]`, `gap-5`, with
  a bottom hairline, `mb-6`. Add `id="details"` to the first section. Anchors
  keep `scroll-mt-32`. Clerk's own hash routes begin `#/` and do not collide.
- Sections `mb-10 md:mb-16`; h2 `mb-3 md:mb-6`.
- `<UserProfile routing="hash" appearance={khemUserProfileAppearance} />`, per
  Decision 6.
- `AddressCard`: `p-4 sm:p-8`; default badge `end-4 top-4`; label `mb-2`;
  actions row `mt-4 pt-3`. Address list gap `gap-2`.
- `AddressBook` form: `px-4 py-5 sm:px-8 sm:py-8`; title `mb-5`; grid
  `gap-y-3 sm:gap-y-5`; actions `mt-5`; buttons `w-full sm:w-auto` on phones,
  primary first.
- `MarketingPreference` and the language note: `px-4 py-4 sm:px-8 sm:py-7`,
  intro `mb-4`. Section stack `gap-3 md:gap-6`.

### Notifications
- `NotificationList` rows `px-4 py-4 sm:px-5 sm:py-5`, `gap-3`.
- Bell popover: confirm it stays inside a 360px viewport now that the bell sits
  at the end of a row that also holds the identity. Keep `end-0`.

## Security requirements

- No change to the gate: `getViewer()` in the layout and in every panel stays
  exactly as it is; `robots: noindex` stays on the layout.
- `AccountIdentity` stays a Server Component. Name and email are not serialized
  into a client bundle.
- No new Server Actions, routes or queries. The address and marketing actions
  are untouched apart from markup around them.
- Clerk: appearance-only change; no `prefetchUI` flag anywhere (§10.2).

## Acceptance criteria

1. At **390×844** (and checked at **360×740**), `/account` with one order shows
   heading, both stats side by side, and the latest order's number + total
   without scrolling past the second screen. No horizontal scroll on any
   account route (`document.documentElement.scrollWidth === innerWidth`).
2. Ledgers on phones are vertical lists with every column's information
   present; from `sm` the table is unchanged.
3. Orders and Vouchers empty states each fit in one phone screen together with
   the header.
4. Profile jump links scroll to each section below the sticky chrome; Clerk's
   own navigation (`#/security` etc.) still works; no sideways scroll.
5. Signed-in name/email visible on phone panels; desktop rail unchanged.
6. **Arabic (`/ar/account/...`)**: mirrored correctly; the bell sits at the
   reading end; amounts, order numbers, emails and codes read LTR; nothing is
   clipped by the Arabic font's taller line box.
7. Storefront `EmptyState` uses (cart, checkout, collection) render pixel-identical
   (default props unchanged).
8. `tsc --noEmit` clean, ESLint clean on changed files, zero `any`.

## Checks to run

```bash
npx tsc --noEmit
npx eslint src/app/[locale]/account src/components/account src/components/ecommerce/EmptyState.tsx src/lib/clerk-appearance.ts
```
Then a live pass with agent-browser at 390×844 and 1440×900, EN and AR, on
each account route, if a signed-in session is available (see the umbrella doc's
open question). Also run the horizontal-overflow eval above on each route.

## Manual test steps (after implementation)

1. `npm run dev`, sign in as a customer with at least one order. Open DevTools →
   device toolbar → iPhone 14 (390×844).
2. `/account`: name and avatar at the top beside the bell; two stat tiles side by
   side; the privilege band if you hold a voucher or credit; the latest order with
   its total on the same line as its number. Open "Track" and check the tracker
   expands smoothly.
3. Tap through the tab strip: Orders → Vouchers & Credits → Profile. The strip
   scrolls, and the active tab has the gold underline.
4. Vouchers & Credits: if you have credit or reward history, check the history
   is a vertical list (no sideways swipe). Widen to ≥640px and check it turns
   back into the table.
5. Profile: tap "Addresses" and "Preferences" in the jump row and check each
   lands below the header. Add an address, edit it, set default, delete. Toggle
   marketing. Open Clerk's "Security" tab inside the card.
6. Use an account with no orders: `/account/orders` empty state fits on screen
   with its button visible.
7. Repeat 2–5 on `/ar/account`: layout mirrored, numbers and emails
   left-to-right, bell at the left end.
8. Desktop (1440 wide): the rail with avatar, name and email is on the left as
   before, and panels look as before, slightly tighter.
9. Open `/cart` with an empty bag. The storefront empty state is unchanged.
