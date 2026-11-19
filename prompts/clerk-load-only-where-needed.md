# Load Clerk only where it's needed

Owner: "Yes, write the Clerk plan" (2026-11-19), after
`prompts/lcp-priority-and-clerk-weight.md` (its `prefetchUI` attempt was
reverted; see that file's "Outcome").

## Goal

A visitor who isn't signed in should download **no Clerk JavaScript**:
today every page loads ~350 KB (84 KB `clerk-js` + ~264 KB `@clerk/ui`).
Most traffic, and every Lighthouse run, is signed out. A signed-in customer
must keep **everything** that works today:

- the nav's account menu, with the admin link for admins;
- sign-out;
- the checkout prefill, and the order linked to their account;
- vouchers, credits and offers at checkout and in the cart;
- comments as themselves on product pages;
- `/account` (profile, orders, notifications) and `/admin`.

## Skills read

- `AGENTS.md`; `.agents/skills/clerk`.
- The installed `@clerk/nextjs` 7.7.4 / `@clerk/react` / `@clerk/shared`
  source and types, for what is public API (no `@internal` props) and what
  `prefetchUI` really does.
- `node_modules/next/dist/docs/` (client components, `next/dynamic`).

## What I found

**The one `<ClerkProvider>`** is in `src/app/[locale]/layout.tsx` and wraps
every page. It's the only reason Clerk loads on public pages.

**Clerk on the client, by route:**

| Where | Uses | Needs |
| :-- | :-- | :-- |
| Nav, every page (`Nav.tsx`) | `useAuth().isSignedIn` | is someone signed in |
| Nav account menu (`AccountMenu.tsx`) | `useUser()` (name, avatar, email), `useClerk().signOut` | user summary + sign-out |
| Product page comments (`CommentForm.tsx`) | `useUser()` (display name only; the server stamps identity) | user summary |
| `/sign-in` (`SignInForm.tsx`), `/sign-up` (`SignUpForm.tsx`) | `<SignIn>`, `<SignUp>`, `useSignUp`, `Show` | **full Clerk + `@clerk/ui`** |
| `/account/*` (`account/layout.tsx`, `AccountSidebar.tsx`, `profile/page.tsx`) | `<UserProfile>`, `SignOutButton` | **full Clerk + `@clerk/ui`** |
| `/admin/*` | no Clerk client components (server `requireAdmin()` only) | nothing on the client |

**On the server, the session is read by Server Actions called from public
pages:**
- `placeCustomerOrder` (checkout), `applyDiscount`, `previewCartOffer` (the
  cart and checkout), `postComment`.
- Each calls `getViewer()` → `auth()`.

**Why "just remove Clerk from public pages" is unsafe:**
- Clerk's session token (`__session`) lives **60 s**, and `clerk-js` refreshes
  it from the browser.
- The middleware (`clerkMiddleware` in `src/proxy.ts`) can only refresh it on
  a **document** request (its handshake redirect). **Server Action POSTs get
  no handshake.**
- So a signed-in customer with no `clerk-js` on the page who spends more than
  a minute at checkout would be treated as a **guest** by
  `placeCustomerOrder`: the order would not be linked to their account, and
  their voucher or credit would not apply.
- **Conclusion:** signed-in visitors must keep `clerk-js` running on every page
  they browse. Only signed-out visitors can go without it.

**How to tell them apart before loading Clerk:**
- Clerk keeps a `__client_uat` cookie on the site's domain (readable by JS):
  a timestamp when signed in, `0` when signed out.
- A visitor who has never signed in has no Clerk cookie at all (checked live:
  a fresh visitor's `document.cookie` holds none).
- So "no `__client_uat`, or `0`" means signed out. If the cookie is ever
  wrong, the worst case is degraded, never broken: see decision 5.

## Design

### Decisions

1. **A KHEM session context replaces Clerk hooks outside the Clerk routes.**
   - `src/providers/session-provider.tsx` (client) exposes `useKhemSession()`
     → `{ status: "signed-out" | "loading" | "signed-in", user: { name,
     email, imageUrl } | null, signOut(): Promise<void> }`.
   - `Nav`, `AccountMenu` and `CommentForm` read this context instead of
     `useAuth`/`useUser`/`useClerk`. Their rendering and behaviour are
     unchanged.
2. **Signed-out visitors load no Clerk.**
   - `SessionProvider` reads `__client_uat` (and any `__client_uat_*`) on mount
     and on `visibilitychange`.
   - Absent or `0` → `status: "signed-out"`; Clerk is never imported.
   - The nav shows the sign-in icon, as today.
3. **Signed-in visitors load Clerk once, as a sibling, not a wrapper.**
   - When the cookie says signed in, `SessionProvider` lazily imports
     (`next/dynamic`, `ssr: false`) `ClerkSessionBridge`.
   - The bridge renders the client `<ClerkProvider>` from `@clerk/nextjs`, with
     the same `appearance`, `localization` and per-locale sign-in/up URLs as
     today, plus **`prefetchUI={false}`**.
   - `prefetchUI={false}` is safe **here only**, because the bridge renders no
     prebuilt Clerk component. Signed-in public pages therefore get `clerk-js`
     (84 KB) but not `@clerk/ui` (264 KB).
   - Inside it, a tiny `<SessionPublisher>` reads `useUser()` and `useClerk()`
     and publishes the user and `signOut` into the context.
   - `clerk-js` running keeps `__session` fresh, so checkout, discounts, offers
     and comments see the customer exactly as today.
   - The page itself is **not** wrapped, so nothing re-mounts when Clerk
     arrives: the nav menu just fills in.
4. **The Clerk routes keep a full provider**, moved from the root into
   segment layouts:
   - `sign-in/` and `sign-up/` get a `layout.tsx` with today's
     `<ClerkProvider>` (default UI prefetch).
   - `account/layout.tsx` wraps its content in the same provider. A shared
     `<KhemClerkProvider locale>` server component holds the props, so they
     are defined once.
   - Each segment provider also renders `<SessionPublisher>`, so the nav
     (which sits above the segment) stays correct on those pages.
   - `SessionProvider` does **not** mount its own bridge on these routes
     (`usePathname()` under `/sign-in`, `/sign-up`, `/account`, with or
     without `/ar`). There is never more than one provider on a page.
   - `/admin` needs no client Clerk. It gets the bridge like any public page
     (the admin is signed in), which keeps the nav menu and its token fresh.
5. **Failure modes are degraded, never broken:**
   - **The cookie says signed out, but the visitor is signed in** (e.g. a
     cookie cleared by hand): the nav shows "sign in". The account icon leads
     to `/account`, whose full provider restores the session and the cookie.
     Server-side `auth()` on document requests still works through the
     middleware handshake.
   - **The cookie says signed in, but the session has expired:** the bridge
     loads, Clerk reports signed out, the context flips to `signed-out`. This
     is the same 84 KB as today minus the UI.
   - **Sign-in or sign-out in another tab:** the cookie is re-read on
     `visibilitychange`. After sign-in completes on `/sign-in`, the next page
     sees the cookie.
6. **No change** to `src/proxy.ts`, the middleware, Server Actions,
   `getViewer()`, `requireAdmin()`, the webhooks, the CSP, or any data.

### Expected effect

| Visitor | Clerk JS today | After |
| :-- | :-- | :-- |
| Signed out, any public page | ~350 KB | **0 KB** |
| Signed in, public page | ~350 KB | ~84 KB (no `@clerk/ui`) |
| `/sign-in`, `/sign-up`, `/account` | ~350 KB | ~350 KB (unchanged) |

## Files likely to change

- New: `src/providers/session-provider.tsx`,
  `src/components/auth/ClerkSessionBridge.tsx`,
  `src/components/auth/SessionPublisher.tsx`,
  `src/components/auth/KhemClerkProvider.tsx`,
  `src/app/[locale]/sign-in/layout.tsx`, `src/app/[locale]/sign-up/layout.tsx`.
- Changed: `src/app/[locale]/layout.tsx` (root provider → `SessionProvider`),
  `src/app/[locale]/account/layout.tsx`, `src/components/Nav.tsx`,
  `src/components/account/AccountMenu.tsx`,
  `src/components/ecommerce/CommentForm.tsx`.
- Docs: `src/docs/production-audit.md` (§11), and the `AGENTS.md` note that
  Clerk providers live per segment.

## Test plan

### Locally, against Clerk's **development** instance

The production instance doesn't run on localhost; that's how the last
incident slipped through.
- Build with the development key pair from `.env.local`, passed as process env
  for that build only. `.env.local` is not edited.
- **Create one disposable test user in the development instance** through
  Clerk's Backend API, with a random password kept in the scratchpad and never
  printed. Delete it at the end. The production instance and its users are
  never touched.
- `.env.local` points at the production database, so tests **do not place
  orders, post comments or change data**. Session freshness is proven with
  read-only signed-in actions.

| # | Scenario | Pass when |
| :-- | :-- | :-- |
| 1 | Signed out: `/`, product, collections, cart, checkout | **No request to `clerk.*`**; nav shows sign-in; guest checkout form renders |
| 2 | `/sign-in`, `/sign-up` (EN, AR) | Clerk forms render; signing in as the test user lands on `/account` |
| 3 | Signed in: `/`, product, cart | `clerk.browser.js` loads, **no `@clerk/ui`**; nav menu shows name/avatar; one provider on the page |
| 4 | Signed in, **wait 90 s** on a product page, then open the cart | `previewCartOffer` (read-only) sees the signed-in user (verified via the action's result or a temporary log) |
| 5 | Signed in, **wait 90 s** on `/checkout` | The contact step is prefilled, and a read-only action shows the server sees the user. **No order is placed.** |
| 6 | `/account`, `/account/profile` | `<UserProfile>` renders; the sidebar sign-out works |
| 7 | Nav menu sign-out on a public page | Signed out; next page loads no Clerk |
| 8 | Sign in in tab A, switch to tab B (public page) | Tab B's nav updates on focus |
| 9 | Client-side navigation `/` → `/account` → `/` while signed in | No crash, no double provider, menu stays correct |
| 10 | Admin user (if the dev instance has one; else noted as owner-only) | Admin link in the menu; `/admin` loads |

### On production, straight after deploy (rollback command ready)

- **Me, signed out:** scenarios 1 and 2 (forms render, EN/AR), plus mobile
  Lighthouse on the four usual pages.
- **You, signed in (I have no production credentials):**
  - nav menu + admin link;
  - `/account`, `/account/profile`;
  - wait a minute on `/checkout` and confirm your details are prefilled. A
    real order is your call;
  - sign out, then sign in again.
- **Rollback:** `ssh khem@179.67.202.31 /srv/khem/current/deploy/rollback.sh
  <previous sha>`, which takes seconds. I'll trigger it myself if any
  signed-out check fails.

## Implementation requirements

- **Commits:**
  1. `SessionProvider`, the bridge, the publisher, `KhemClerkProvider`
     (unused yet);
  2. Nav, AccountMenu and CommentForm read the context;
  3. move the providers (root → segments) and gate the bridge;
  4. docs.
  Every commit builds and runs.
- Public Clerk APIs only. `prefetchUI={false}` only in the bridge, never in a
  provider that renders prebuilt components.
- Deploy at a quiet hour; the owner is reachable for the signed-in checks.

## Security requirements

- No change to authentication or authorisation. The server remains the only
  judge of identity: `auth()` and `requireAdmin()` are untouched.
  `__client_uat` decides only **whether to load** Clerk, never who someone is.
- The development-instance test user is created and deleted through the
  Backend API, and its password is never printed or committed.

## Acceptance criteria

- Signed-out pages make **no** request to `clerk.khemperfumes.com`, locally
  (dev instance) and live.
- All ten local scenarios pass. Live, the signed-out checks pass and the owner
  confirms the signed-in ones.
- `tsc`, `eslint`, tests and `next build` pass.
- Mobile Lighthouse on `/`, `/ar` and the two product pages, reported against
  `eee60c2`.
