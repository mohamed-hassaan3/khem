# Fix: account pages crash on the first client-side visit (d1d91f4)

Owner report (2026-11-20): "when signed in, the first click to the profile
page shows 'This page couldn't load'. Reloading works."

## Status

- **Production was rolled back to `eee60c2`** (before the Clerk change) as soon
  as the report came in. Sign-in was verified there. Customers are not affected
  while this is open; Clerk simply loads on every page again, as before.
- `main` still contains `d1d91f4`. This prompt fixes it before it is
  redeployed.

## Reproduced and diagnosed (locally, Clerk development instance)

- **Steps:** sign in, land on any public page (full load), then client-navigate
  to `/account/profile`, either directly or via the account sidebar.
- **Result:** the error boundary appears ("This page couldn't load").
- **Console:** `Error: Clerk was not loaded with Ui components at
  assertComponentsReady → mountUserProfile`.

**Cause.**
- On public pages, `<ClerkSessionBridge>` boots Clerk with
  **`prefetchUI={false}`**. In `@clerk/react` that means `@clerk/ui` is
  **never** loaded by that Clerk instance.
- Clerk is a page-wide singleton (`window.Clerk`). On a client-side
  navigation, the account segment's `<KhemClerkProvider>` **reuses that
  instance**, so `<UserProfile>` finds no UI and throws.
- A reload works because there the account provider is the first to boot
  Clerk, with UI loading on.

My earlier test plan covered account → public, but not public → account while
signed in. The claim in `ClerkSessionBridge.tsx` that `prefetchUI={false}` is
"safe here" was wrong for this reason.

## Fix

1. **Remove `prefetchUI={false}` from `ClerkSessionBridge`.** The background
   Clerk then loads `@clerk/ui` like any normal provider, so whichever
   provider comes second finds the UI ready.
   - **Cost:** signed-in visitors on public pages also download `@clerk/ui`
     (~264 KB), as they did before `d1d91f4`.
   - **Unchanged:** signed-out visitors (most traffic, and Lighthouse) still
     load **no Clerk at all**. That was the main win, and it stays.
2. Correct the comments in `ClerkSessionBridge.tsx`, `AGENTS.md` §10.2 and
   `production-audit.md` §11: **`prefetchUI={false}` must not be used on any
   provider on this site**, because a client navigation carries the instance
   into pages that need the UI.
3. *Considered and rejected:* forcing a full page load whenever a signed-in
   visitor enters `/account`. It keeps the 264 KB saving for signed-in
   visitors, but adds a visible double navigation and a hand-maintained route
   list. Not worth it for a minority of traffic.

## Test plan (local, development instance; then live)

Locally, with the disposable development-instance user (deleted at the end;
any test `"User"` row that the `/account` prefetch creates is removed):

| # | Scenario | Pass when |
| :-- | :-- | :-- |
| R1 | Signed in, full load `/collections`, client-nav → `/account/profile` | `<UserProfile>` renders, no error |
| R2 | Signed in, full load `/`, menu → Dashboard, then sidebar → Profile | `<UserProfile>` renders |
| R3 | Signed in, `/account/profile` → client-nav home → back to profile | renders both times |
| R4 | Signed out, full load `/`, client-nav → `/sign-in`, then `/sign-up` | Clerk forms render |
| R5 | The original scenarios 1, 3, 4 and 7 (signed-out = 0 Clerk requests; signed-in menu; session fresh after 90 s; nav sign-out) | unchanged |

Live after deploy (rollback target `eee60c29dcdf` ready):
- I check signed out: 0 Clerk requests on public pages; sign-in and sign-up
  forms render.
- **You check signed in:** from the home page, open the account menu →
  Dashboard → Profile **without reloading**, and also open the menu → Profile
  path directly. The previous signed-in checklist (§11) applies too.

## Commits

1. `fix(auth): let the background Clerk load its UI` (bridge + comments).
2. docs (`AGENTS.md` §10.2, `production-audit.md` §11 addendum).

Checks before deploy: `tsc`, `eslint`, tests, `next build`.
