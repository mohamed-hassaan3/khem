# Stage 1 (v2) — Account redesign: "The Private Salon"

Supersedes `prompts/mobile-ux-stage-1-account.md`. Built from the approved
canvas mock (https://claude.ai/artifact/Ewnr77HanrXk98tjGe2BFu, approved
2026-11-21). The user asked to build it straight after approving the mock, so
this file is the record of the build, not a gate.

## Goal

Rebuild `/account/*` to match the mock: a four-tab account (Home · Orders ·
Wallet · Profile) with a bottom tab bar on phones and a rail on desktop; a
membership card; an "on its way" order spotlight; a merged activity feed;
wallet tickets; and a settings-style profile. English and mirrored Arabic,
KHEM palette, calm motion. Real data only.

## Skills read

- `AGENTS.md` (§2.2 motion, §3 tokens, §8 force-dynamic account, §10.1/10.2
  Clerk rules: provider only on account/auth, never `prefetchUI={false}`).
- `.agents/skills/clerk/SKILL.md`. Clerk Backend API checked in the installed
  typings: `clerkClient().sessions.getSessionList({ userId, status })` returns
  `{ data, totalCount }`; `User.externalAccounts[].provider`.

## Existing code inspected

Account layout and five panels; `services/account.ts` (`getOrdersForUser`
embeds items + events), `schemas/db/orders.ts`, `types/{account,credit,voucher,
rewards,notification}.ts`, `services/{credits,vouchers,rewards,notifications}`,
`lib/notification-copy.ts` (`notificationSentence`, `notificationHref`),
`OrderTracker` (`buildStations`), `CopyCodeButton`, `AddressBook`,
`MarketingPreference`, `NotificationBell`, `SignOutButton`, en/ar dictionaries,
`globals.css` (`khem-rise`), `supabase/sql/0015_orders.sql` (OrderItem has
`productSlug`), `0001_catalog.sql` (`ProductImage` keyed by `productSlug`).

## Decisions

1. **Routes unchanged** (`/account`, `/orders`, `/vouchers`, `/profile`,
   `/notifications`; email links keep working). "Vouchers & Credits" is
   labelled **Wallet**; Notifications leaves the tabs (bell + Home activity +
   "See all").
2. **Real thumbnails:** order lines gain `productSlug` and a primary
   `imageUrl` via PostgREST embed `OrderItem → Product → ProductImage`. No
   schema change. A missing image falls back to a drawn bottle.
3. **Order rail = existing three stations** (Being prepared → On its way →
   Delivered, plus halted states) from `buildStations`, now exported. Nothing
   is invented (no "Placed" station without an event).
4. **Orders filter** is a `?filter=active|completed` search param (server, no
   JS). Each order is a native `<details>`; the first in-progress order opens by
   default, and a `#KHEM-…` hash from emails opens its order.
5. **Bell** moves from the layout into each panel header (`AccountBell`, a
   server wrapper; `notificationsForUser` is request-memoised).
6. **Clerk rows** ("Name, email & phone", "Password & sign-in") open
   `<UserProfile routing="hash">` in an in-page sheet at `#/` or `#/security`.
   Security row subtitle: connected providers + active-session count from the
   Clerk Backend API (fails soft to no subtitle).
7. **Motion:** CSS only. Staggered `khem-rise` on sections; rail fill;
   `<details>` body rise; card hover lift; tab indicator. All removed under
   `prefers-reduced-motion`. Account is private and `noindex`, so a 700 ms
   entrance has no SEO/LCP cost on public pages.
8. **New copy** lives under `account.hub` in `en.ts` and `ar.ts`. Existing keys
   are reused where they fit.
9. Components replaced by the redesign and no longer imported are deleted.

## Files likely to change

`src/app/[locale]/account/{layout,page,orders/page,vouchers/page,profile/page,notifications/page}.tsx`,
`src/components/account/*` (new: `AccountTabBar`, `AccountBell`, `MemberCard`,
`OrderSpotlight`, `OrderRail`, `ActivityFeed`, `GlanceRows`, `WalletActivity`,
`VoucherTicket`, `CreditPanel`, `ClerkAccountRows`, `CopyButton`,
`OrderThumb`, `account-nav.ts`; reworked: `AccountSidebar`, `AccountIdentity`,
`AccountPageHeader`, `OrderCard`, `OrderTracker`, `AddressBook`,
`AddressCard`, `MarketingPreference`, `NotificationList`, `SignOutButton`),
`src/services/account.ts`, `src/schemas/db/orders.ts`,
`src/types/account.ts`, `src/lib/i18n/dictionaries/{en,ar}.ts`,
`src/app/globals.css`.

## Security requirements

Gate unchanged (`getViewer()` in layout and every panel; `noindex`). Every
query stays scoped to the session's Clerk id or verified email. Session count
is read server-side for the viewer's own id only. No new actions or routes.

## Acceptance criteria

- Matches the mock's layout on 390px and 1440px, EN and AR (mirrored).
- Bottom tab bar on phones (≥44px targets, safe-area aware); rail on `lg+`.
- No horizontal scroll on any account route at 360/390px.
- All figures come from services; empty states for every section.
- `tsc --noEmit` and ESLint clean; reduced motion disables every animation.

## Checks

`npx tsc --noEmit`, ESLint on changed files, live screenshots through the
user's signed-in Chrome (CDP 9222) at 390×844 and 1440×900 in EN and AR, and
an overflow check.

## Manual test steps

See the hand-off message for this stage.
