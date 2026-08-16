# Sign-in returns the visitor to the page they came from

## Goal

After a successful sign-in (or sign-up), return the visitor to the page they
were on when the flow started, instead of always dropping them at `/account`.
`/account` stays the fallback for the cases where there is no known origin.

## Skills read

- `.agents/skills/clerk` (SKILL.md — no redirect guidance in it)
- Clerk runtime source: `node_modules/@clerk/shared/dist/router.mjs` —
  `PRESERVED_QUERYSTRING_PARAMS = ["after_sign_in_url", "after_sign_up_url",
  "redirect_url"]`. Clerk carries `redirect_url` across its own internal
  navigations (factor-one, SSO callback, verification), and it takes precedence
  over `fallbackRedirectUrl`. That is the mechanism this change uses — no
  hand-rolled post-login navigation.

## Existing code inspected

- `src/app/[locale]/sign-in/[[...sign-in]]/page.tsx` — static shell, renders
  `<SignIn signUpUrl fallbackRedirectUrl="/account">`.
- `src/app/[locale]/sign-up/[[...sign-up]]/page.tsx` + `src/components/auth/SignUpForm.tsx`
  (client island for the marketing checkbox).
- `src/app/[locale]/layout.tsx:265-275` — `<ClerkProvider>` with locale-prefixed
  `signInUrl`, `signUpUrl`, `signInFallbackRedirectUrl`, `signUpFallbackRedirectUrl`.
- `src/proxy.ts:146-173` — `clerkMiddleware`, redirects signed-out `/account*`
  requests to the localized `/sign-in`, losing the intended destination.
- `src/app/[locale]/account/{layout,page,orders/page,addresses/page,profile/page}.tsx`
  — each `redirect(localizePath(locale, AUTH_PATHS.signIn))` on a null viewer.
- `src/components/Nav.tsx:330-365` — signed-out account icon links to `/account`;
  signed-in it is `<UserButton>`. `useAuth()` (client) drives the swap.
- `src/lib/routes.ts` — `ACCOUNT_PATHS`, `AUTH_PATHS`.

## Decisions and assumptions

1. **Query param, not state.** The origin travels as `?redirect_url=<path>` on
   the sign-in URL. This is Clerk's own contract, survives the multi-step flows,
   and needs no client state.
2. **Same-origin relative paths only.** `redirect_url` is attacker-controllable
   (it is a link anyone can craft), so an open redirect is the risk here. A
   sanitizer accepts only values that start with a single `/`, rejecting `//evil.com`,
   `/\evil.com`, `https://…`, and anything containing control characters or a
   backslash. Anything rejected falls back to `/account`.
3. **Never bounce back into an auth route.** A sanitized target that resolves to
   `/sign-in` or `/sign-up` (in either locale) is discarded — otherwise a signed-in
   visitor lands on the form they just completed.
4. **`/account` stays the fallback**, on `<ClerkProvider>` and on both forms, so
   a bare visit to `/sign-in` behaves exactly as it does today.
5. **The nav account icon changes destination when signed out**: from `/account`
   to `/sign-in?redirect_url=<current path>`. That is the user's explicit ask —
   clicking the icon from a product page and signing in returns to that product
   page. On `/sign-in` or `/sign-up` itself no param is added.
6. **Pages stay static.** The redirect param is read on the client
   (`useSearchParams`) inside the form islands, not from server `searchParams`,
   so `/sign-in` and `/sign-up` keep their prerendered output. Each island is
   wrapped in `<Suspense>` at the page level as Next requires.

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/lib/auth-redirect.ts` *(new)* | `AUTH_REDIRECT_PARAM`, `sanitizeAuthRedirect()`, `signInPathWithReturn()` |
| `src/proxy.ts` | attach `redirect_url` = requested public path (+search) on the account gate redirect |
| `src/app/[locale]/account/{layout,page,orders/page,addresses/page,profile/page}.tsx` | same, for the server-side `redirect()` guards |
| `src/components/auth/SignInForm.tsx` *(new client island)* | reads `redirect_url`, sanitizes, passes it to `<SignIn>` and onto `signUpUrl` |
| `src/components/auth/SignUpForm.tsx` | same pass-through for `<SignUp>` and `signInUrl` |
| `src/app/[locale]/sign-in/[[...sign-in]]/page.tsx` | render `<SignInForm>` inside `<Suspense>` |
| `src/app/[locale]/sign-up/[[...sign-up]]/page.tsx` | wrap `<SignUpForm>` in `<Suspense>` |
| `src/components/Nav.tsx` | signed-out account icon → sign-in with the current path as return target |

## Implementation requirements

- `sanitizeAuthRedirect(value: string | null | undefined): string | null`
  - returns `null` unless the value starts with `/` and not `//` or `/\`
  - returns `null` on any `\`, control character, or whitespace
  - returns `null` when the path (locale stripped, via `stripLocale`) is
    `/sign-in` or `/sign-up` or a segment beneath them
  - otherwise returns the value unchanged (path + optional search + hash)
- `signInPathWithReturn(locale, target)` builds the localized `/sign-in` with an
  encoded `redirect_url`, and omits the param entirely when the target sanitizes
  to `null`.
- No `any`. Strict null handling with the codebase's explicit `=== null` style.
- Comments follow the house voice already in these files: explain the *why*
  (open-redirect defence, Clerk's param precedence), never restate the code.
- No visual change to either auth page.

## Security requirements

- Redirect targets are relative, same-origin paths only — validated by the
  sanitizer above, on both the server (proxy, account guards) and the client
  (form islands). Never construct the target from a full URL supplied in the query.
- The proxy keeps building its URL from `request.url` for the origin, so the
  destination stays same-origin by construction.
- Auth routes are excluded as targets to avoid a redirect loop.
- Nothing new is logged; the param carries a path only.

## Acceptance criteria

1. Signed out, on `/perfume/<slug>` → click the account icon → sign in →
   land back on `/perfume/<slug>`.
2. Signed out, visit `/account/orders` directly → gated to `/sign-in?redirect_url=/account/orders`
   → sign in → land on `/account/orders`, not `/account`.
3. Visit `/sign-in` with no param → sign in → land on `/account` (today's behaviour).
4. `/ar/...` origins return into the Arabic tree; the param survives the switch
   between the sign-in and sign-up forms.
5. `/sign-in?redirect_url=https://evil.com`, `//evil.com`, `/\evil.com`, and
   `/sign-in` are all ignored → visitor lands on `/account`.
6. Password reset / email verification (multi-step) still return to the origin.
7. `/sign-in` and `/sign-up` remain prerendered (`○`) in the build output.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build` (confirm `/sign-in` and `/sign-up` still prerender)

## Manual test steps

1. `npm run dev`, sign out.
2. Open `/perfume/<any-slug>`, click the account icon in the nav — the URL is
   `/sign-in?redirect_url=%2Fperfume%2F<slug>`. Sign in. You are back on the PDP.
3. Sign out. Open `/ar/account/addresses` directly. You are gated to
   `/ar/sign-in?redirect_url=%2Far%2Faccount%2Faddresses`. Click "Sign up"
   inside the card — the param is still on the URL. Go back, sign in — you land
   on `/ar/account/addresses`.
4. Sign out. Open `/sign-in` with no query. Sign in → `/account`.
5. Sign out. Open `/sign-in?redirect_url=https://example.com` and
   `/sign-in?redirect_url=//example.com`. Sign in each time → `/account`,
   no off-site navigation.
