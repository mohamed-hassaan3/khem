# Stage 6 — Admin: "The Desk" (plan, awaiting mock approval)

Whole-app redesign, admin part. Replaces the stage list's "6 Admin foundation ·
7 Admin commerce · 8 Admin content & marketing" with one plan in four
sub-stages, built the Stage 1 way: canvas mock → approval → build → self-test
→ local commit → wait for OK. Mock:
https://claude.ai/artifact/FJmVsddwazAm6Q9whdQpJ9 (phone Today, phone Menu,
phone Orders, phone sent campaign, desktop Today with the new rail).

## Goal (user, 2026-11-22)

1. UI/UX first: reorganise the admin navigation from scratch so any admin
   understands it; every section (orders, campaigns, finance, …) mobile first,
   as Stage 1 did for the account.
2. Then audit every feature: functions work, are connected to each other,
   and the logic holds.
3. Every search/filter input in the admin updates in place — no whole-page
   reload or full-screen loader.
4. Campaigns: show the email addresses a campaign went to, and more logic.

## Skills read

`AGENTS.md` (§3 tokens, §8 revalidate rule in `src/lib/admin/revalidate.ts`,
§8.1 prelaunch, §10.1 `requireAdmin()` in the layout and first in every admin
action, 404 on failure). `supabase` skill for the campaign reads. Next docs in
`node_modules/next/dist/docs/` (loading.js, linking-and-navigating).

## Existing code inspected

`admin/layout.tsx`, `AdminShell.tsx` (rail: 7 groups, 29 links, second level
under Content), `AdminSearch.tsx`, all 70 admin `page.tsx` (list in the audit),
`[locale]/loading.tsx` (full-screen `LoadingScreen`), campaign pages,
`CampaignRecord`, `CampaignDispatch`, `CampaignForm`,
`services/admin/campaigns.ts`, `actions/admin/campaigns.ts`, SQL
`0033/0034/0036/0055/0056/0057`.

## Audit (live, signed in as the second allowlisted admin, 390×844 + 1440×900)

1. **Phone dashboard overflows**: document 681px wide at a 390px viewport;
   11 stat tiles stack one per row (~120px each); the latest-orders table is
   cut off. The storefront marquee, header and full footer wrap the admin.
2. **Storefront sign-up pop-up opens over the admin** ("Enter the World of
   KHEM") on navigation.
3. **Navigation**: 29 links in 7 groups at 10px uppercase; on a phone it is a
   long drawer under the storefront header. Names describe tables, not jobs:
   "Promotions", "Offers", "Discounts" are three different systems with
   names a new admin cannot tell apart; "Analytics" vs "Sales & Profit" vs
   "Reports" (finance) overlap.
4. **Search**: `AdminSearch` debounces into `router.replace(?q=)`; the list
   updates, but nothing shows it is working, so the old list sits there and
   jumps. Page-to-page navigation shows the storefront's full-screen loader
   (root `loading.tsx`) over the admin. Rewards uses a plain
   `<form method="get">` — a full page reload.
5. **Campaigns**: a sent campaign shows only "X of Y letters accepted". The
   send log (`campaign_sends`, keyed by email since 0036, with `sentAt` and
   the provider `error`) is never shown, so the desk cannot see who received
   it, who did not, or why.

## Proposed information architecture (no URL changes)

| Group | Entries (label → route) |
|---|---|
| Today | Dashboard → `/admin` |
| Sell | Orders → `/admin/orders` · Customers → `/admin/customers` · Loyalty → `/admin/rewards` + `/admin/credits` (tabs) |
| Catalogue | Products · Collections & categories (tabs; scent families inside) · Stock → `/admin/inventory` (+ history tab) |
| Marketing | Email campaigns · Subscribers (`/newsletter`) · Discount codes (`/discounts`) · Sales (`/promotions`) · Welcome offers (`/offers`) · Announcement bar |
| Website | Home page (`/content/landing`) · Story pages (World of KHEM, journal, testimonials) · Menu & footer (`/navigation`) · Stockists |
| Money & reports | Sales & profit (+ Items sold tab) · Finance (overview, expenses, targets, reports) · Visitors & search (`/search`, `/analytics`, Umami ↗) |
| Settings | `/admin/settings` |

Every label carries a one-line description in the phone menu. Labels are
sentence case at 14px. Old routes stay, so bookmarks and the 110 in-code
references keep working.

## Shell

- Admin routes drop the storefront marquee, header, footer, cookie/offer
  pop-ups; the admin gets its own 56–60px header (mark, "Find anything" /
  ⌘K jump, bell, account). Needs a check of how `[locale]/layout.tsx` renders
  chrome (Stage 3 `prelaunch` guard shows the pattern).
- Phone: bottom tab bar Today · Orders · Catalogue · Marketing · Menu; Menu
  is the full grouped list with descriptions and a jump search.
- Desktop: rail with readable groups; the current group open, others
  collapsible.
- `admin/loading.tsx`: a quiet in-panel skeleton, so navigation never shows
  the full-screen loader and the shell stays.

## Sub-stages

- **6a Shell & navigation** — header, rail, tab bar, menu, jump search,
  admin `loading.tsx`, no storefront chrome or pop-ups on `/admin`.
  Shared admin primitives (page header, stat tiles two-up, list-as-cards on
  phones, filter pills, empty states) in the Stage 1 language. `AdminSearch`
  gets `useTransition` + inline "Searching…" + the list dims while pending;
  Rewards form becomes `AdminSearch`.
- **6b Sell & catalogue screens** — Today, Orders (+ detail, manual order),
  Customers, Loyalty, Products, Collections & categories, Stock.
- **6c Marketing & website screens** — campaigns (see below), subscribers,
  codes, sales, welcome offers, announcement bar, home page, story pages,
  menu & footer, stockists.
- **6d Money & settings** — sales & profit, items sold, finance (4),
  visitors & search, settings.
- **7 Logic audit** — every action and service: `requireAdmin()` first,
  Zod input, revalidate list (AGENTS §8), cross-feature links (order →
  customer → credits/points; discount ↔ campaign voucher; stock ↔ orders;
  finance reads sales). Findings reported; fixes to money/auth/data logic
  only after the user agrees.

## Campaigns (6c)

- **Who it went to**: on a sent or sending campaign, a recipient list read
  from `campaign_sends` (email, source: subscriber / customer / typed,
  `sentAt`, refused with the provider's reason), search by address,
  filter Delivered / Refused, 50 per page, CSV download. Admin-only read
  through the service-role client; no schema change.
- **Proposed logic (each needs the user's yes)**:
  1. *Retry the refused* — re-queue only addresses with an error, through the
     existing dispatch/lease path.
  2. *Duplicate as new* — copy content and audience into a new draft.
  3. *Before sending*: show the actual address list the audience resolves to
     (`campaign_audience()`), with how many are excluded (unsubscribed,
     duplicates across subscriber + customer).
  4. *Frequency guard*: warn when an address received another campaign in the
     last N days.
  Opens/clicks are not proposed: they need Resend webhooks and new storage.

## Security

`requireAdmin()` unchanged in the layout and every action; new actions
(retry, duplicate, recipient read) call it first. The recipient list is
read server-side only. No route, gate or cache mode changes. Customer and
subscriber emails appear only inside `/admin`.

## Acceptance (each sub-stage)

No horizontal scroll at 360/390px on any admin route; ≥44px targets on phones;
search/filter changes never show the full-screen loader and keep focus in the
input; `tsc` + ESLint clean; captures at 390×844 and 1440×900.

## Open questions for the user

1. Approve the mock / IA (or name changes).
2. "Emails appear for who send campaign": is it the recipient list (as in the
   mock), or the sender name/address the email shows ("From")?
3. Which campaign logic items (1–4) to build.
4. OK to remove the storefront header/footer from admin pages?

## Manual test steps

Written per sub-stage in its outcome section.

## Decisions (user, 2026-11-22)

- Mock and IA approved as drawn.
- Campaigns: the recipient list as in the mock, plus **the exact list before
  sending** (who the audience resolves to, who is excluded). Retry, duplicate
  and the frequency guard: not now.
- Remove the storefront header and footer from admin pages: yes.
- Added: check the customer **invitation** flow, and let the admin see every
  customer's email, registered and walk-in (6b, Customers).

## Outcome — 6a shell & navigation (built 2026-11-22)

- `admin-nav.ts`: one table for rail, menu, tab bar, section tabs and jump.
  No route moved; merged entries use tabs (Loyalty, Collections & categories,
  Stock, Story pages, Sales & profit, Finance).
- `AdminShell.tsx` rewritten: own sticky header (mark, "Find anything" /
  ⌘K jump that also opens an order by number, View the shop, bell), desktop
  rail with readable grouped labels (Website and Money fold until you're in
  them), phone tab bar Today · Orders · Catalogue · Marketing · Menu, full
  menu sheet with one-line descriptions, section-tab pills.
- `StorefrontOnly.tsx` + `[locale]/layout.tsx`: no announcement bar, header,
  footer, bag drawer, cookie banner or sign-up pop-up on `/admin`. Storefront
  unchanged (checked `/`). `globals.css`: `--header-h: 0` and `--chrome-h` =
  desk header on admin.
- `admin/loading.tsx`: in-panel skeleton; the shop's full-screen loader no
  longer covers the admin.
- `AdminSearch`: transition + "Searching…" + the list dims while pending;
  focus stays in the field. Rewards' GET form now uses it (no full reload).
- `AdminTable` (28 screens): phone rows become labelled cards, actions on one
  line; header, buttons, pills and empty states in the Stage 1 look.
- Toasts sit above the phone tab bar.

Checked live at 390×844 and 1440×900: no horizontal scroll on Today,
products, customers, campaigns, discounts, rewards; jump "khem-2026-1192"
opens that order; search keeps focus and swaps results in place.

## Outcome — campaign audience list (built 2026-11-23, user request)

On a draft or scheduled campaign, "Who will receive it" sits between the
Audience section and Sending: every address the saved audience reaches
(subscribers, customers, typed), with name where known, search, filters
(Everyone / Subscribers / Customers / Typed / Left out), a tick per address,
"Leave out all shown" / "Include all shown", 50 at a time.

- `supabase/sql/0081_campaign_exclusions.sql`: `campaign_exclusions` table
  (service role only, frozen by trigger once a campaign is sent);
  `campaign_audience_all()` = 0055's body; `campaign_audience()` = that minus
  exclusions (same signature, so breakdown and the send claim follow);
  `campaign_audience_preview()` for the list.
- `setCampaignExclusion` action: `requireAdmin()` first, Zod, editable check,
  upsert/delete, revalidates the page.
- Dry run on the live database inside a rolled-back transaction: applies
  cleanly; latest campaign previews 7 addresses, breakdown unchanged (7).
- **Not yet applied** — `npm run db:migrate` targets the live database and
  waits for the user's OK. Apply it before deploying this code.

## Outcome — 6b part 1: Today, Orders, Customers, Invitations (2026-11-23)

- **Today** (`admin/page.tsx`) rebuilt as in the mock: date + "Today",
  "Needs you" (new orders to open, to prepare and ship, running low — each
  opens the filtered list, or says "nothing waiting"), the period's figures
  two-up on phones / four on desktop with the range tabs, the curve, latest
  orders, running out, at a glance, quick actions. Same services as before.
- **`AdminOrderList`** (new, shared): one tappable row per order — number,
  New marker, total, status pill, customer (`<bdi>` so Arabic names do not
  reorder the date), date, items, in-store. Used by Today and Orders.
- **Orders**: one pill row (All · New n · Preparing · Shipped · Delivered ·
  Cancelled · Refunded) instead of three chip rows, plus Online / In store;
  "Manual order". `FilterChips` restyled as pills for every list, a chip may
  set its own param, and changing a filter resets the page.
- **Customers**: Everyone / Registered / Walk-in filter (customer_summary
  cannot filter and caps at 200 rows a call, so filtered views read the whole
  set through `listAllAdminCustomers()` and page it in memory); email shown in
  its own column; "Invite" on walk-ins that have an email; Download CSV.
- **CSV export** `admin/customers/export/route.ts`: gates itself with
  `getAdminActor()` (404 otherwise; a route handler is not under the admin
  layout), no-store, UTF-8 BOM for Arabic in Excel, formula-injection guard.
  Signed-out request: redirected by the proxy, no data.
- **Invitations** `admin/customers/invitations` (tab beside Customers): the
  invite form (pre-filled from a walk-in's Invite link) and every invitation
  read from Clerk — Waiting / Joined / Expired / Withdrawn, search, Withdraw,
  Send again (withdraw + a fresh `inviteCustomer`). Found live: a pending
  invitation for someone who had already signed up on their own; such rows
  now say so and offer only Withdraw.
- **Campaign audience list** verified live on a draft: 19 addresses (7
  subscribers + 12 customers); leaving one out moved the list and the send
  panel to 18; restored to 19.

Checks: tsc + ESLint clean; 390px overflow sweep of 36 admin routes: none.
Still to do in 6b: Products, Collections & categories, Stock, Loyalty, order
and customer detail pages in the new language (they fit phones already).
