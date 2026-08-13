# Prompt — Transform `/account` into localized App Router routes and wire Clerk authentication

## Goal

Two things ship together, because neither is worth shipping alone:

1. **The transform.** `src/app/[locale]/account/page.tsx` was the last `react-router-dom` SPA file in the tree. It imported `react-router-dom` (not a dependency) and therefore **did not build**. It becomes a set of localized App Router routes matching the idiom of `/cart` and `/wishlist`: server shell, thin client islands, dictionary-driven EN/AR, theme tokens, Lucide icons, `<LocaleLink>`.

2. **Real authentication.** `@clerk/nextjs` v7.7.4 is wired: `<ClerkProvider>` in the locale layout, `clerkMiddleware` composed with the existing locale rewrite in `src/proxy.ts`, KHEM-themed `/sign-in` and `/sign-up` catch-all routes, `/account/*` protected, and a real sign-out.

**Data rule, and it is the hard constraint:** the original file shipped an invented customer — "Alexandra Hassan", `alexandra@email.com`, three fabricated orders totalling $1,735, two Cairo addresses, hardcoded stat counts. **Every one of those literals is deleted and none is replaced by another literal.** Identity comes from the Clerk session. Orders and addresses have no store yet — no `Order`/`Address` table exists, `prisma/` holds only an `AGENTS.md`, `src/data/` has no customer data — so those panels render honest empty states behind a documented service seam, exactly as `src/services/products.ts` documents the Supabase query each of its functions will become. AGENTS.md: *UI must display stored data only.*

**Composition rule:** many small components, none doing two jobs, no file over ~150 lines.

---

## Skills read

- `AGENTS.md` — §1 core rules, §2.2 visual language, §3 tokens, §5 prompt contract, §6 stack, §7 structure, §8 routing matrix (`/account` = Protected / Dynamic), §9 schema (`User`, `Address`, `Order`, `Role`), §10 middleware, §11 component standards, §12 checklist.
- `.agents/skills/clerk` — router skill. Version table read against `package.json`: `@clerk/nextjs@7.7.4` ⇒ **current SDK (v7+), not Core 2.** Every `Core 2 ONLY` callout in the skills below is ignored.
- `.agents/skills/clerk-setup` — `ClerkProvider` placement (**inside `<body>`**, not wrapping `<html>` — the v7 rule), `proxy.ts` vs `middleware.ts` (Next 16 ⇒ `proxy.ts`), env var names, `clerk doctor`.
- `.agents/skills/clerk-custom-ui` — appearance prop: `variables` for colour/typography, `options` (v7 name; `layout` was the Core 2 name) for logo and social button variant.
- `https://clerk.com/docs/nextjs/getting-started/quickstart` — fetched, not recalled. Confirms package name, provider placement, the `proxy.ts` filename for Next 16+, and the env var names.
- **Not read, and why:** the session hook injected `workflow` and `ai-sdk` on lexical matches for "workflow" and "next step". Neither applies — no durable workflow, no model call. `supabase` is not read either: no Supabase call ships here; the seams are *documented* for it, which is a text exercise.

---

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/app/[locale]/account/page.tsx` | The untransformed SPA source. `import { Link } from 'react-router-dom'` — broke the build. `ORDERS`/`ADDRESSES` fabricated arrays. `useState<Tab>` over five tabs. Inline hex everywhere, inline `'Cinzel', serif`, `onMouseEnter`/`onFocus` doing CSS's job, a dead "Sign Out" button, desktop-only `280px 1fr` grid. |
| `src/app/[locale]/cart/page.tsx`, `wishlist/page.tsx` | The reference transform. Both carried a comment promising a revisit *"when the Clerk session lands"* — this change is that moment, so both comments are updated (see decision 10). |
| `src/app/[locale]/layout.tsx` | The real root layout: renders `<html>`/`<body>`, mounts `I18nProvider > CartProvider > WishlistProvider`. There is no `src/app/layout.tsx`. |
| `src/proxy.ts` | Locale rewrite, `as-needed` prefixing. Its comment already says the matcher *"mirrors AGENTS.md §10.1 so Clerk's middleware can be layered in later"*. |
| `src/lib/i18n/*` | `LOCALES`/`isLocale`/`localizePath`/`stripLocale`, `localeMetadata`, `ltrIsland`, `interpolate`. |
| `src/lib/i18n/dictionaries/en.ts` | Defines `type Dictionary = typeof en`, so `ar.ts` is shape-checked — a new key is a **compile error** until translated. |
| `src/components/ecommerce/PageHeader.tsx`, `EmptyState.tsx` | Shared utility-page furniture. Reused verbatim, not forked. |
| `src/providers/*`, `src/lib/persistent-store.ts` | Provider idiom: `useSyncExternalStore`, `useMemo` value, `null` default, hook that throws. `useWishlist().count` feeds the overview stat. |
| `src/services/products.ts` | The service idiom to copy: async, exact projection, each function carrying the Supabase query it will become. |
| `src/components/Nav.tsx` | Links `/account` in the desktop rail and the mobile sheet. Where the signed-in affordance goes. |
| `package.json` / `.env.local` | `@clerk/nextjs@7.7.4` installed by the user; `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` present. `@clerk/localizations` added by this change. Node v20.19.5 clears Clerk v7's 20.9.0 floor. |
| `prisma/`, `src/data/` | `prisma/` holds only `AGENTS.md`; `src/data/` has no customer data. Confirms there is nowhere for order history to come from. |

---

## Decisions & assumptions

1. **Nested routes, not `useState` tabs** — `/account`, `/account/orders`, `/account/addresses`, `/account/profile`. Real URLs: shareable, back-button correct, server-rendered per panel, each becoming its own Supabase query later. Sidebar links carry `aria-current` from `usePathname()`.
2. **Wishlist is a link, not a tab.** `/wishlist` already exists and is fully built.
3. **Prebuilt Clerk components, themed — not custom `useSignIn` flows.** Hand-rolling means owning password reset, MFA, OAuth callbacks, bot protection, and every error string in two languages, for a worse result.
4. **`/account/profile` renders `<UserProfile />`.** Name, email, phone, password, connected accounts, and active sessions are Clerk-owned records.
5. **Orders and addresses render empty states behind a service seam.** `src/services/account.ts` ships `getOrdersForUser` / `getAddressesForUser` / `getAccountSummary`, all async, all returning empty, each carrying the exact Supabase query it will become against the §9 models. **No component changes when the data lands.**
6. **Locale-aware auth URLs** via `localizePath`, passed to `<ClerkProvider>` where `locale` is already in scope. `/ar/account` signed out → `/ar/sign-in` → back to `/ar/account`, never crossing into English.
7. **`clerkMiddleware` composes with the locale rewrite; it does not replace it.** The rewrite moves into `localeRewrite(request)`; the default export becomes `clerkMiddleware(async (auth, request) => { … return localeRewrite(request) })`. The path test runs against the *public* pathname (`/account`, `/ar/account`) because that is what the request carries at middleware time — the `/en/` prefix only exists after the rewrite.
   **Revised during implementation:** `createRouteMatcher` is deprecated in v7 (it warns at runtime), and Clerk now directs auth checks into each resource because matcher globs drift from real routing. So the proxy performs the check with `stripLocale` — one code path for both URL shapes, no glob to fall out of step — purely as an *early* redirect, and the security boundary moves into the account layout and every panel. Deleting the proxy block would cost a redirect, not a protection. It is kept because `[locale]/loading.tsx` streams a ~100KB shell before the layout resolves, so without it an anonymous request is served the whole page before being told to leave.
8. **Protection is resource-based, in the layout *and* every panel.** Each calls `getViewer()` and redirects locale-aware. A page never assumes a session it did not observe.
9. **The signed-out gate is the sign-in page.** One gate at one URL, KHEM-framed, with links to the guest-accessible `/cart` and `/wishlist` beneath it.
10. **Account routes are `force-dynamic`; `/cart` and `/wishlist` stay static shells.** Their "revisit when Clerk lands" comments are **updated, not acted on**: both still hold zero server-side per-visitor data (state is `localStorage`), so a dynamic render would cost an invocation per view and buy nothing. The rewritten comments say exactly that, so the next reader does not re-open a settled question.
11. **`<ClerkProvider>` inside `<body>`, outside `<I18nProvider>`** — v7 requires inside-`<body>`; outermost so `<UserButton>` in `Nav` and every account island sit within it.
    **Revised during implementation:** the `dynamic` prop is *not* set. It was, and the build output showed every one of the site's thirty routes flipping from prerendered to `ƒ` — an invocation per view on pages with no session data to show. The routes that read the session declare `force-dynamic` themselves, which is all Clerk needs. Verified by diffing the build output with and without it.
12. **Nav gains a signed-in affordance** — `<SignedIn>`/`<SignedOut>` around `<UserButton>` and the account link, plus a sign-out row in the mobile sheet.
13. **Sign-out is real** — `useClerk().signOut({ redirectUrl: localizePath(locale, "/") })`.
14. **Overview stats stop being literals.** Orders and lifetime spend derive from `getAccountSummary` (`0` / `$0` today, correct by construction later); the wishlist count reads live from `useWishlist().count`.
15. **Arabic Clerk UI ships too** — `@clerk/localizations` supplies `arSA`, passed as `localization` under `ar`.
16. **No RBAC, no `/admin`, no webhook user sync in this change.** §9 has a `Role` enum and §10 an admin matcher, but `/admin` does not exist and there is no `User` table to sync a `clerkId` into. Wiring `sessionClaims.metadata.role` against nothing would be unverifiable. It lands with the Supabase migration; `src/services/account.ts` documents the join and `src/lib/auth.ts` documents the claim.

---

## Files changed

**New**

```
src/app/[locale]/account/layout.tsx            Sidebar shell + auth() guard
src/app/[locale]/account/page.tsx              Overview (rewritten from scratch)
src/app/[locale]/account/orders/page.tsx
src/app/[locale]/account/addresses/page.tsx
src/app/[locale]/account/profile/page.tsx      <UserProfile />
src/app/[locale]/sign-in/[[...sign-in]]/page.tsx
src/app/[locale]/sign-up/[[...sign-up]]/page.tsx
src/components/account/AccountSidebar.tsx      Client: nav + aria-current
src/components/account/AccountIdentity.tsx
src/components/account/SignOutButton.tsx
src/components/account/StatGrid.tsx
src/components/account/OrderCard.tsx
src/components/account/AddressCard.tsx
src/components/account/MemberBenefits.tsx
src/components/auth/AuthShell.tsx
src/lib/clerk-appearance.ts                    KHEM appearance, one definition
src/lib/auth.ts                                requireUserId + documented role claim
src/services/account.ts                        Documented Supabase seams
src/types/account.ts                           Viewer, OrderSummary, SavedAddress
```

**Modified:** `src/proxy.ts`, `src/app/[locale]/layout.tsx`, `src/components/Nav.tsx`, `src/lib/routes.ts`, both dictionaries, `cart/page.tsx` + `wishlist/page.tsx` (comments only), `package.json`.

**Deleted:** the `ORDERS` and `ADDRESSES` arrays and every hardcoded identity string.

---

## Implementation requirements

**Routing & data** — `dynamic = "force-dynamic"` and `robots: { index: false, follow: false }` on every account route; no `generateStaticParams` there. `params` is a Promise in Next 16 — `await` then narrow with `isLocale`. `await auth()` (never un-awaited). Money through `formatPrice`; dates through `Intl.DateTimeFormat` with the active locale, never a hardcoded date string.

**UI** — theme tokens only, zero raw hex in TSX, `font-heading`/`font-body` never inline `'Cinzel', serif`, hover/focus in CSS not `onMouseEnter`, Lucide at `strokeWidth={1.25}`, `<Reveal>` for motion (ease-out, no spring), sidebar collapsing to a scrollable strip under `lg`, RTL-correct logical properties and `ltrIsland` around English records.

**Auth** — `<ClerkProvider dynamic>` inside `<body>` with per-locale `signInUrl`/`signUpUrl`/fallback redirects and `localization` under `ar`. `src/proxy.ts` keeps its export name, matcher, and rewrite; `clerkMiddleware` wraps it. Appearance defined once in `src/lib/clerk-appearance.ts`.

**Dictionary** — new `account.*` and `auth.*` blocks in `en.ts`, mirroring the `cart.*` shape, then translated in `ar.ts`. A missing Arabic key is a type error; that is the check, and it must pass rather than be silenced.

---

## Security requirements

- `CLERK_SECRET_KEY` imported nowhere outside `@clerk/nextjs/server`, never in a `"use client"` file, never under a `NEXT_PUBLIC_` name; `.env.local` stays out of git.
- Protection enforced in `proxy.ts` **and** re-read via `await auth()` in the route.
- `userId` comes from the session only — never from a route param, search param, or client prop. No account route accepts a user identifier as input.
- Matchers cover both the prefixed and unprefixed locale forms; `/ar/account` must not slip past the gate.
- `robots: { index: false, follow: false }` on every account route; no account URL in `sitemap.ts`.
- No PII in `localStorage` — the persisted stores keep holding ids only.
- Redirect targets built with `localizePath` from a validated locale, so no open redirect is reachable.

---

## Acceptance criteria

1. `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass. No `react-router-dom` import remains in `src/`.
2. Zero `any`; zero raw hex in TSX; zero inline `'Cinzel', serif`.
3. Signed out, all four account routes redirect to `/sign-in`; `/ar/account*` to `/ar/sign-in`.
4. Signed in, each route renders its own URL and panel with correct `aria-current`.
5. `grep -riE "alexandra|KH-2024|EGY[0-9]|Zamalek|1,735" src/` returns nothing.
6. Orders and addresses render translated empty states; no fabricated record under either locale.
7. Overview shows `0` orders, `$0` spent, and the **live** wishlist count.
8. Sign-out returns to the locale-correct home page; `/account` is protected immediately after.
9. `ar.ts` type-checks with every new key translated; Clerk's own UI renders in Arabic under `/ar`.
10. The locale rewrite still works for every existing route.
11. No file added here exceeds ~150 lines.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
grep -rn "react-router-dom" src/                             # expect: no matches
grep -rniE "alexandra|KH-2024|EGY[0-9]|Zamalek|1,735" src/   # expect: no matches
grep -rn "CLERK_SECRET_KEY" src/                             # expect: no matches
```

## Manual test steps

1. `npm run dev`.
2. Signed out, visit `/account` → redirected to `/sign-in`, KHEM-framed, obsidian and gold, no default Clerk purple. Same for `/account/orders` and `/account/addresses` directly.
3. Visit `/ar/account` → `/ar/sign-in`, RTL, Clerk's form in Arabic, `/ar` prefix never lost.
4. Sign up at `/sign-up` → returned to `/account`; sidebar shows the session's real name and email; the avatar initial derives from that name.
5. Overview reads `0` orders / `$0` / live wishlist count. Save a fragrance in another tab, reload → the stat moves.
6. Each sidebar link changes the URL; the active link is gold with a leading rule; Back walks them in order. Orders and addresses show translated empty states. Profile renders `<UserProfile />` in KHEM colours.
7. The sidebar wishlist link goes to `/wishlist`.
8. Sign out → land on `/` (or `/ar`). Press Back → `/account` bounces to `/sign-in` (not served from bfcache).
9. Nav: signed out shows the account icon → sign-in; signed in shows `<UserButton>`; the mobile sheet shows a sign-out row. Check at 375px and 1440px.
10. Responsive at 375 / 768 / 1440: sidebar collapses to a scrollable strip, no panel scrolls horizontally.
11. Regression: `/`, `/heritage`, `/collections`, `/cart`, `/wishlist`, `/perfume/<slug>` all load under both locales — the middleware composition is the one change that could break every route on the site.
12. Keyboard: tab from the top of `/account` reaches every sidebar link then sign-out, with a visible gold ring.

---

## Next step — Supabase

This change ends at the seams. The follow-up is: `User` table keyed by `clerkId` (§9), a Clerk webhook syncing `user.created` / `user.updated` / `user.deleted` into it, `Address` and `Order` tables, RLS policies keyed on the Clerk JWT's `sub`, `Role` promoted into `sessionClaims.metadata.role`, and `/admin` behind `isAdminRoute`. Every one of those has exactly one file to touch here, named in `src/services/account.ts` and `src/lib/auth.ts`.
