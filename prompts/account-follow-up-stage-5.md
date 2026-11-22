# Stage 5 — Account follow-up

Part of the whole-app redesign (stage list in `prompts/storefront-redesign-stage-2.md`
hand-off; working agreement: self-audit → build → self-test → local commit →
wait for OK to push). Stage 1 (`prompts/account-redesign-stage-1.md`) rebuilt
`/account/*` as "The Private Salon". Stages 2–4 changed the chrome, storefront
and auth around it. This stage checks the account against them and fixes what
the live audit found. No new routes, no new data, no redesign.

## Goal

Make the account consistent with Stages 2–4 and fix the defects a signed-in
live pass shows at 390×844 and 1440×900, EN and AR. Small, targeted changes.

## Skills read

`AGENTS.md` (§2.2 motion, §3 tokens, §8 account is force-dynamic, §10.1/10.2:
Clerk provider only on account/auth, never `prefetchUI={false}`, identity
decided on the server). `clerk` skill: only the `User.hasImage` field, already
used by `AccountMenu.tsx`. Supabase / AI SDK not needed.

## Existing code inspected

`app/[locale]/account/{layout,page,orders,vouchers,profile,notifications,addresses,preferences}`,
`components/account/{AccountIdentity,AccountPageHeader,AccountTabBar,AccountSidebar,account-nav,AccountMenu}`,
`components/consent/CookieConsent.tsx`, `components/ecommerce/EmptyState.tsx`,
`lib/auth.ts` (`getViewer`), `globals.css` (`body:has([data-account-tabbar])`).
Code sweep: no hard-coded English, no low-contrast text, dates and numbers
already follow `ARABIC_INTL_LOCALE` / Latin digits.

## Audit (live, dev server, signed in as the test account, 2026-11-22)

The test account has no orders, vouchers, credits or notifications, so only
the empty states could be seen live. The populated views (order card, rail,
spotlight, voucher ticket, credit panel, notification list) are covered by
code review only — see "Open item".

1. **Clerk's placeholder avatar.** `getViewer()` maps `user.imageUrl`, which
   Clerk always fills, with a generated purple avatar when the customer never
   uploaded one. So the KHEM monogram fallback in `AccountIdentity` never
   shows: the rail and the Profile hero carry a purple-and-white circle, while
   the header's `AccountMenu` (which checks `hasImage`) shows the gold "T"
   monogram. Two different avatars for the same person on one screen.
2. **Bell misaligned when a panel has a subtitle.** `AccountPageHeader` is
   `items-end`, so on Wallet (intro line) and Orders (summary line) the bell
   drops to the subtitle instead of sitting beside the title.
3. **Cookie banner hides the tab bar on phones.** Both sit at the bottom; the
   banner (`z-990`) covers the bar (`z-30`) until the visitor decides, so on
   a first visit to `/account` the four sections are unreachable without
   answering the banner first.
4. Checked, sound: tab bar (safe area, active rule), desktop rail, Home member
   card and glance rows, Profile rows, Wallet empty states, AR mirroring, no
   horizontal overflow at 390px on any account route (EN + AR).
5. Seen, not changed: the dev-only "1 Issue" badge (React `eval` under the dev
   CSP, known from Stage 4). Sequential `ensureUserRowId` → `claimGuestOrders`
   → reads on Home/Orders: ordering is data logic (claim must precede the
   order read), left for Stage 9 (performance) and not to be changed without
   asking.

## Decisions

1. **Avatar:** `getViewer()` returns `imageUrl` only when `user.hasImage` is
   true, else `null`, so every account surface shows the same monogram as the
   header. Display field only; `getViewer()`'s identity fields and gating are
   untouched.
2. **Header alignment:** the bell aligns with the title row (top of the
   heading block, `items-start` + a small offset to centre it on the h1), on
   every panel. Home (no subtitle) looks the same as today.
3. **Banner above the bar:** while the account tab bar is on the page and
   visible (below `lg`), the cookie banner's bottom offset includes the bar's
   height plus the safe area, via the same `body:has([data-account-tabbar])`
   hook the footer padding uses. CSS only; the banner's logic, copy and
   consent handling are untouched.
4. Anything further that the populated-state check turns up (see "Open item")
   is fixed in the same stage if it is UI only, and listed in the record.

## Files likely to change

`src/lib/auth.ts` (one line in the viewer mapping),
`src/components/account/AccountPageHeader.tsx`,
`src/components/consent/CookieConsent.tsx` or `src/app/globals.css`
(banner offset), this prompt (outcome section).

## Implementation requirements

- Strict TS, no `any`; Server/Client boundaries unchanged.
- KHEM tokens only; motion unchanged; reduced motion still disables all.
- EN + AR; logical properties (`start/end`, `ms/me`) only.
- No change to pricing, payments, checkout, auth gating or data writes.

## Security requirements

No new routes, actions or queries. `getViewer()` stays session-only and keeps
returning `null` for no session; only the avatar field's value changes. Nothing
under `/account` gains caching.

## Acceptance criteria

- A customer without an uploaded photo sees the gold monogram in the rail,
  the Profile hero and the header — one avatar everywhere. A customer with a
  photo still sees the photo.
- The bell sits beside the title on Home, Orders, Wallet, Profile and
  Notifications, EN and AR.
- With the cookie banner open on a phone, the tab bar is visible and tappable
  beneath it.
- No horizontal scroll at 360/390px on any account route, EN + AR.
- `npx tsc --noEmit` and ESLint clean on changed files.

## Checks to run

`npx tsc --noEmit`; ESLint on changed files; agent-browser captures signed in
at 390×844 and 1440×900, EN + AR, of every account route; overflow sweep at
360px; cookie banner open + tab bar visible at 390px.

## Open item — populated states

To check order cards, the rail, vouchers and credits with real rows, I need a
signed-in account that has them. The test account is empty. Options: sign in
locally as the other allowlisted account if it holds test orders, or you place
a test order on the test account, or skip (code review only).

## Manual test steps (after implementation)

1. `npm run dev`, sign in, open `/account` on a phone (or devtools 390×844).
2. Without a profile photo: the rail (desktop) and `/account/profile` show the
   gold initial, matching the header's account button.
3. `/account/vouchers` and `/account/orders` (with orders): the bell sits beside
   the big title, not lower beside the subtitle line.
4. Clear site data, open `/account` on a phone: the cookie banner sits above the
   bottom tab bar; tap Orders while the banner is open — it navigates.
5. Repeat 2–4 on `/ar/account`.

## Outcome (built 2026-11-22)

Populated states checked by signing in locally as the second allowlisted
account (4 orders, 6 notifications, an uploaded photo). Built as planned, plus
three fixes that check found:

- **Avatar:** `getViewer()` passes `imageUrl` only when `user.hasImage`. Test
  account (no photo) now shows the monogram; the account with a photo still
  shows it.
- **Bell:** `AccountPageHeader` is `items-start` with an offset that centres
  the bell on the title. Wallet and Orders no longer drop it to the subtitle.
- **Cookie banner:** `data-cookie-consent` hook on the banner wrapper;
  `globals.css` lifts it by the tab bar's height below `lg` while the bar is on
  the page. Verified: banner above the bar, bar tappable.
- **Order timeline order (found live):** the vertical rail inside an opened
  order read "On its way → Being prepared → Delivered" (reached stops reversed,
  future stops appended). Now journey order, top to bottom, matching the
  horizontal rail and the component's own doc; the connector is gold only up
  to the last reached stop.
- **Orders filter (found live):** "In progress · 1" / "Completed · 3" wrapped
  to two lines at 390px. Single line at 360px now (10px, 0.06em tracking on
  phones; unchanged from `sm`).
- **Dates (found live):** `formatAccountDate` printed "November 21, 2026"
  (`en-US`) beside order dates reading "21 Nov 2026". Now `en-GB`
  ("21 November 2026"), as its doc comment already stated. Arabic unchanged.
  Also used by the checkout voucher picker (display only).

Seen, not changed:
- `ensureUserRowId` logs `duplicate key … "user_email_live_idx"` for the
  second account locally: the dev Clerk instance gives it a different user id
  from the row already holding that email. Data logic, environment-specific;
  needs your call if it also appears in production logs.
- Order line names are stored snapshots ("ONYX NIGHT" in capitals on one
  order): data, not UI.
- In Arabic, a long Latin product name in the order summary line truncates
  from its start ("…plete Library"), a bidi effect; minor.
- Dev-only: next/image aspect warning for the avatar inside the hidden desktop
  rail; React `eval` CSP badge (known since Stage 4).

Checks: `npx tsc --noEmit` and ESLint on changed files clean; captures at
390×844 and 1440×900, EN + AR, of Home, Orders, Wallet, Profile,
Notifications; 360px overflow sweep of all five routes in EN + AR: none.
