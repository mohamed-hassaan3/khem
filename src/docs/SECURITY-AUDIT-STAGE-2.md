# KHEM — Security Audit, Stage 2: Fixes Applied

> Executed 2026-09-06 on branch `security-audit-stage-1`.
> Findings from `src/docs/SECURITY-AUDIT-STAGE-1.md`.
> Prompt: `prompts/security-audit-stage-2-fixes.md`.
>
> **Nothing is committed or pushed.** Every change is in the working tree for
> review, per the fix-authority decision.
>
> **No production write occurred.** The SQL migration is a *file*; it takes
> effect only when you run `npm run db:migrate`.

---

## Result

**All eleven actionable findings (F1–F11) are fixed.** F12 is deferred to
Stage 4 as planned. One new finding, **F13**, was discovered while verifying
F6 and is routed to Stage 3.

| Check | Before | After |
|---|---|---|
| `npm audit` | **4 high** | **0 vulnerabilities** |
| `npx tsc --noEmit` | exit 0 | **exit 0** |
| `npm run lint` | exit 0 | **exit 0** |
| `npm run build` | exit 0 | **exit 0** |
| Security headers on a response | **0** | **5** |
| JSON-LD `</script>` breakout | **reproducible** | **blocked** |
| `/design-preview` serves the design system | **yes** | **no — deleted** |

---

## Fixed findings

| Severity | Finding | Fix | Verified by |
|---|---|---|---|
| MEDIUM–HIGH | F1 JSON-LD XSS | `src/lib/json-ld.ts` + call site | Payload no longer escapes the tag; round-trips losslessly |
| HIGH (dep) | F2 sharp/libvips CVEs | `next` → 16.3.4; `nanoid` → 3.3.18 | `npm audit` → 0 |
| MEDIUM | F3 No security headers | `headers()` in `next.config.ts` | 5 headers on a live response |
| MEDIUM | F4 RLS-bypassing views | `0064_security_hardening.sql` | Written; readers confirmed service-role only |
| MEDIUM | F5 No limit on intent route | 20 / 10 min | Build passes; limiter shared with checkout |
| LOW–MED | F6 `/design-preview` public | Directory + 3 references deleted | Absent from the built route table |
| LOW | F7 `NEXT_PUBLIC_KHEM_PRELAUNCH` in docs | Section rewritten | — |
| LOW | F8 "Applied last" untrue | Header corrected | — |
| LOW | F9 Stale caller list | Replaced with the audited list of 7 | — |
| LOW | F10 5 unrevoked trigger definers | In `0064` | — |
| LOW | F11 Unpinned `search_path` | In `0064` | — |

---

### F1 — JSON-LD stored XSS — **FIXED**

New module `src/lib/json-ld.ts` exports `jsonLdHtml()`, which escapes `<` as
`<` before the string reaches `dangerouslySetInnerHTML`. Applied at
`src/app/[locale]/journal/[slug]/page.tsx`.

The comment that made the false claim — *"`JSON.stringify`… escapes what needs
escaping"* — was replaced rather than left standing beside the fix. A wrong
explanation next to correct code is how the code gets "simplified" back.

**Proof:**

```
BEFORE: {"headline":"</script><img src=x onerror=alert(1)>"}
        contains </script>?  true    ← breaks out of the script element
AFTER:  {"headline":"</script><img src=x onerror=alert(1)>"}
        contains </script>?  false   ← safe
        round-trips to original?  true   ← structured data unchanged
```

The escape is lossless: `<` is valid JSON and parses back to `<`, so
Google's parser sees exactly the string it was given.

**Why a module rather than a one-line `.replace()`.** Stage 3 (Phase 19.5.6)
adds Product, Offer, Organization, WebSite and BreadcrumbList JSON-LD across the
catalogue. A per-call-site fix is a rule each of those must remember. The
helper is one they cannot forget, and its header states that every
`application/ld+json` block in the app must take its `__html` from there.

### F2 — Dependency vulnerabilities — **FIXED**

`next` 16.2.12 → **16.3.4**, `eslint-config-next` likewise. This cleared all
four `sharp`/libvips CVEs (GHSA-f88m-g3jw-g9cj) — which mattered here because
`next/image` optimises the visitor-uploaded `comment-images` bucket, so public
bytes reach libvips.

The upgrade surfaced a **different** high advisory that the old tree had masked:
`nanoid` < 3.3.18 (GHSA-2v37-7h3g-55p8), reachable only as a build-time
transitive of `postcss`. Cleared with plain `npm audit fix` — a patch bump
inside 3.3.x. **`--force` was not used**; npm's own suggestion for it warned it
would move outside the stated dependency range.

```
$ npm audit
found 0 vulnerabilities
```

### F3 — Security headers — **FIXED (CSP in Report-Only)**

`headers()` added to `next.config.ts`, applied to `/:path*`.

Rather than hardcode origins, the CSP derives them the way `commentImagePattern()`
in the same file already derives its image host:

- **Clerk** — decoded from `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, which encodes
  the frontend API host. This matters because that host differs between a
  development instance (`*.clerk.accounts.dev`) and a production one (a custom
  domain), and a CSP naming the wrong one does not degrade — it breaks sign-in
  outright. Deriving it means the policy follows whichever instance a deployment
  points at.
- **Supabase** — from `NEXT_PUBLIC_SUPABASE_URL`.

Both fall back to an empty list on a missing or malformed value, so a checkout
without credentials still builds.

**Verified on a live response** from `next start`:

```
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self'
  'unsafe-inline' https://certain-phoenix-89.clerk.accounts.dev … js.stripe.com …
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
X-Frame-Options: DENY
```

Note the Clerk host resolved correctly from the key.

**Two deliberate restraints**, both per the brief's *"do not add headers
blindly"*:

1. **CSP is Report-Only.** A storefront with Stripe Elements and Clerk embedded
   has more third-party origins than static analysis can enumerate with
   confidence, and the failure mode of guessing wrong is not a warning — it is a
   checkout that silently stops taking money. Promote it after a clean preview.
2. **HSTS is not set.** Vercel already issues it for the apex domain. A
   `max-age` written into application code outlives the reasoning behind it, and
   getting it wrong locks visitors out of the domain for the length of the
   directive. It belongs to the platform.

`'unsafe-inline'` remains in `script-src`, required today by the pre-paint
`sessionStorage` probe in `app/[locale]/layout.tsx` and by the JSON-LD blocks.
Removing it means threading a nonce through both — a change to rendering, not to
this file, and the natural next hardening step once the policy enforces.

### F4 / F10 / F11 — one migration, **written, not applied**

`supabase/sql/0064_security_hardening.sql`:

- `alter view … set (security_invoker = on)` on `credit_balances`,
  `customer_directory`, `reward_balances`.
- `revoke all on function` for the five trigger-returning definers.
- `slug_is_reserved()` recreated with `set search_path = ''`.

**The Stage 1 caveat is resolved.** Stage 1 flagged that `security_invoker`
might break admin reads. Verified since: all three views are read *exclusively*
through `getSupabaseAdmin()` — `src/services/credits.ts:40`,
`src/services/rewards.ts:58`, `src/services/admin/customers.ts:74`,
`src/services/admin/campaigns.ts:41`. `service_role` bypasses RLS either way, so
**no current query changes behaviour**. There is no anon or authenticated read
path to break.

Revoking EXECUTE does not stop the five functions firing as triggers — a trigger
runs as the table's owner, not the caller — so the constraints they enforce
(`0045`, `0047`, `0048`, `0052`) are untouched. The file says so, to stop
someone "restoring" the grants later.

**This migration has not been applied.** Run it when ready:

```bash
npm run db:migrate
```

It must print *"PostgREST schema cache reload signalled"* — per AGENTS.md §9, a
migration applied any other way leaves a stale cache and the failure is silent.

### F5 — Rate limit on `/api/checkout/intent` — **FIXED**

20 per 10 minutes per client, applied before the body is read and before Stripe
is touched, matching the ordering in `src/actions/checkout.ts`.

Higher than checkout's 8 because one legitimate order hits this route several
times — on mount, after a declined card, on every refresh of the confirmation
page — and most of those take the existing reuse branch and cost nothing. What
it stops is a script with a valid order id hammering Stripe, each miss being a
metered call.

Answers **429**, not the uniform refusal shape the other guards use: unlike
those, this one is not concealing anything. The caller is meant to learn they
are going too fast and come back.

### F6 — `/design-preview` — **DELETED**

The page's own header said *"⚠️ TEMPORARY — design review surface. Delete before
this direction ships."* Taken at its word.

`src/proxy.ts:169` named the three parts to remove together, and all three are
gone: the directory (9 files, 2,933 lines), the `DESIGN_PREVIEW_PATH` constant
and its proxy branch, and the `/design-preview` entry in
`EXEMPT_PREFIXES` (`src/lib/prelaunch.ts`). A stale comment reference in
`src/app/prelaunch/layout.tsx` was corrected too.

Confirmed absent from the built route table.

### F7 / F8 / F9 — documentation corrections — **FIXED**

- **F7** `src/docs/Temporary-Pre-Launch-Cover.md` recommended
  `NEXT_PUBLIC_KHEM_PRELAUNCH` and a `NODE_ENV === "development"` guard. Both
  are wrong for this codebase, and the second is worse than cosmetic — it would
  make the cover *impossible to use in production*, which is the only place it
  is for. Section rewritten and marked superseded, pointing at
  `src/lib/prelaunch.ts` as the authority.
- **F8** `supabase/sql/0006_privileges.sql` claimed it was "applied last". It
  runs sixth of sixty-four. The corrected header explains why the file still
  works (the `alter default privileges` clauses cover later tables) and warns
  against the specific wrong fix — adding a late table to the `revoke` at line
  27, which has already run by then.
- **F9** `src/lib/supabase.ts` said the RLS-bypassing client had one caller. It
  has seven. Replaced with the audited list and what authorises each, plus a
  note that adding an eighth is a security decision.

---

## New finding — F13, soft 404 on every unknown URL

Found while verifying F6.

**`/design-preview` no longer serves the design system** — the fix worked. But
it, and every other unmatched URL, is answered **`HTTP/1.1 200 OK`** with the
404 page rendered inside it:

```
$ curl -sI http://localhost:3997/definitely-not-real
HTTP/1.1 200 OK
        body renders "Page Not Found"
        <title>KHEM Perfumes | Luxury Egyptian Perfumes | Essence of Heritage</title>

$ curl -s -o /dev/null -w "%{http_code}" http://localhost:3997/api/nonexistent
404
```

**Cause.** `src/app/[locale]/[...rest]/page.tsx` correctly calls `notFound()`,
but `src/app/[locale]/loading.tsx` makes the response start streaming before the
route resolves — `src/proxy.ts` describes this streaming behaviour for a
different reason — so the 200 status is already committed when `notFound()`
fires. The `/api/*` tree has no `loading.tsx` and returns a correct 404, which
isolates the cause.

**Pre-existing.** Not introduced by any Stage 2 change; the API comparison
confirms it is structural.

**Impact is SEO, not security.** No content leaks. But every broken link, every
retired URL and every crawler probe returns 200 with the *home page's title*,
which search engines index as thin duplicate content — and the brief's Phase
19.5.14/19.5.15 name "soft 404s" explicitly.

**Not fixed here**, deliberately: it is outside the F1–F11 scope you approved,
and the fix touches streaming and loading behaviour rather than a security
control. **Routed to Stage 3**, where it belongs with the crawlability work.

---

## Verification commands — actually executed

| Command | Result |
|---|---|
| `npm install next@16.3.4 eslint-config-next@16.3.4` | ok |
| `npm audit` (after upgrade) | 1 high — `nanoid` |
| `npm audit fix` | ok |
| `npm audit` (final) | **found 0 vulnerabilities** |
| `rm -rf .next && npm run build` | **exit 0** |
| `npx tsc --noEmit` | **exit 0** |
| `npm run lint` | **exit 0** |
| `next start` + `curl -I /` | 5 security headers present, Clerk host correct |
| `curl -I /definitely-not-real` | 200 — F13 |
| `curl /api/nonexistent` | 404 — isolates F13's cause |
| `node -e` JSON-LD escape check | breakout blocked, round-trip lossless |
| `git status --porcelain` | 20 modified/deleted, 6 new — all intended |

**A note on one intermediate result.** The first `tsc` run after deleting
`design-preview` reported four errors — all inside `.next/types/validator.ts`,
generated artifacts from the previous build still referencing the deleted route.
`rm -rf .next` and a rebuild cleared them. They were stale output, not source
errors, and are recorded here rather than omitted.

---

## Files changed

| File | Change | Finding |
|---|---|---|
| `src/lib/json-ld.ts` | **new** | F1 |
| `src/app/[locale]/journal/[slug]/page.tsx` | use helper; correct the comment | F1 |
| `package.json`, `package-lock.json` | next 16.3.4, nanoid 3.3.18 | F2 |
| `next.config.ts` | `headers()` + CSP builders | F3 |
| `supabase/sql/0064_security_hardening.sql` | **new, not applied** | F4, F10, F11 |
| `src/app/api/checkout/intent/route.ts` | rate limit | F5 |
| `src/app/design-preview/**` (9 files) | **deleted** | F6 |
| `src/proxy.ts` | drop `DESIGN_PREVIEW_PATH` + branch | F6 |
| `src/lib/prelaunch.ts` | drop exempt prefix | F6 |
| `src/app/prelaunch/layout.tsx` | stale comment reference | F6 |
| `src/docs/Temporary-Pre-Launch-Cover.md` | superseded section rewritten | F7 |
| `supabase/sql/0006_privileges.sql` | corrected header | F8 |
| `src/lib/supabase.ts` | corrected caller list | F9 |

Net: **+612 / −3,183** lines.

No business logic, pricing, checkout flow, RLS policy or UI design was altered.
Every change is a security fix, a dependency bump, a deletion, or a comment
correction.

---

## What you need to do

1. **Review `git diff`.** Nothing is committed.
2. **Apply the migration** when ready: `npm run db:migrate`. Confirm it prints
   *"PostgREST schema cache reload signalled"*.
3. **Deploy to a preview** and watch the browser console for CSP Report-Only
   violations across: home, a product page, cart, **card checkout**, sign-in,
   and `/admin`.
4. **When the report is clean**, rename `Content-Security-Policy-Report-Only`
   to `Content-Security-Policy` in `next.config.ts` to enforce it.
5. Confirm HSTS is set on `khemperfumes.com` at the Vercel/DNS layer.

---

## Still open

| Severity | Finding | Stage |
|---|---|---|
| LOW (SEO) | **F13** soft 404 — unknown URLs return 200 | Stage 3 |
| INFO | F12 AGENTS.md documents a non-existent architecture | Stage 4 |
| — | 4 × `UNVERIFIED — requires staging` from Stage 1 | needs a staging DB |

The four unverified items are unchanged and still need writes to settle:
cross-account credit redemption, the two-buyer race, concurrent discount
redemption, and Stripe webhook replay. Stage 1 §3.6 and §7 carry the exact
probes.

Phases 16–17 (build/lint/typecheck, functional regression) are covered above for
the automated half. The interactive half of Phase 17 — placing a real test order
through the card rail — still needs Stripe test keys, which are not present on
this machine.
