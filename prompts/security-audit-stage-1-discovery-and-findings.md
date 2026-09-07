# Security Audit — Stage 1: Discovery & Findings (Phases 0–15)

Source brief: `src/docs/KHEM_FINAL_SECURITY_QA_AND_DEVELOPER_HANDOFF.md`
(2,077 lines, as updated 2026-09-06 with Phase 19.5).

This is **stage 1 of 4**. It is a **read-only audit**. No application code, SQL,
or configuration is modified in this stage. The single deliverable is an
evidence-backed findings report.

---

## Goal

Produce `src/docs/SECURITY-AUDIT-STAGE-1.md`: a complete, evidence-backed
PASS / FAIL / N/A determination for Phases 0–15 of the handoff brief, with
`file:line` citations for every claim, and a proposed patch for every FAIL —
proposed, not applied.

Stage 1 answers "what is actually wrong". Stage 2 fixes it. Stage 3 does the
public-surface and SEO work. Stage 4 documents everything and attacks it once
more.

---

## Skills read

- `.agents/skills/clerk` — auth model, `currentUser()` vs `auth()`, webhook
  verification, why Clerk v7 deprecates middleware-based route matching.
- `.agents/skills/supabase` — RLS, policy shapes, `security definer`,
  `search_path` pinning, service-role trust boundary, PostgREST grants.
- `.agents/skills/ai-sdk` — only for `src/lib/search/` (the embedding path and
  `AI_GATEWAY_API_KEY` handling); not otherwise in scope.

Not read, deliberately: the `vercel-plugin` workflow and AI-SDK skills the
prompt hook suggested. This is a static security audit of an existing
codebase; neither Vercel Workflow nor AI SDK authoring is part of it, and
AGENTS.md §4 restricts skill use to the three above.

---

## Existing code inspected before writing this prompt

| Area | Finding |
| --- | --- |
| `package.json` | Next 16.2.12, React 19.2.4, Clerk 7.7.4, `@supabase/supabase-js` 2.109.0, Stripe 22.5.0, Resend 6.20.0, Zod 4.4.3, `ai` 7.0.64. Scripts: `dev`, `build`, `lint`, `embed`, `db:*`. **No `typecheck` script, no test framework.** |
| `src/proxy.ts` | Single entry gate. `clerkMiddleware()` wrapping locale rewrite + currency cookie + pre-launch cover. Explicitly documents that it is **not** the security boundary. |
| `src/lib/supabase.ts` (188 ln) | `import "server-only"`. Two clients: `getSupabasePublic()` (anon) and `getSupabaseAdmin()` (`SUPABASE_SECRET_KEY`, RLS-bypassing). |
| `src/lib/admin/auth.ts` (120 ln) | `getAdminActor()` / `requireAdmin()` compare Clerk `currentUser()`'s **verified** primary email against `ADMIN_EMAILS`, default `khem.official@outlook.com`. |
| Service-role call sites | `src/actions/admin/shared.ts`, `src/actions/checkout.ts`, `src/app/api/webhooks/stripe/route.ts`, `src/services/{discounts,offers,rewards,welcome}.ts`. Seven modules — each needs its own §3.4 justification. |
| `src/app/api/` | 9 route handlers: `cart/catalog`, `checkout/intent`, `search`, `webhooks/clerk`, `webhooks/stripe`, and 4 crons (`sweep-unpaid-orders`, `order-feedback`, `expire-credits`, `send-campaigns`). |
| `src/actions/` | 12 public modules + 21 under `admin/`. |
| `src/services/` | 22 public modules + 21 under `admin/`. |
| `supabase/sql/` | 63 migrations, ~20,324 lines. 30 files enable RLS; ~26 named policies; ~40 `security definer` functions. |
| `next.config.ts` | Image optimizer tuning, locale redirects, `outputFileTracingIncludes`. **No `headers()` block — no CSP, HSTS, nosniff, Referrer-Policy or Permissions-Policy anywhere in the repo.** |
| `vercel.json` | 4 cron entries only. No headers. |
| `.gitignore` | `.env*` ignored with `!.env.example` opt-in. `git log --all --diff-filter=A -- '.env*'` returns **only** `.env.example` — no secret was ever added under an env filename. |
| `src/app/robots.ts`, `src/app/sitemap.ts` | Both exist and are considered work — the sitemap is DB-driven with full `alternates.languages` hreflang; robots deliberately does not block `/search`, with the crawl-vs-index reasoning written out. |
| SEO metadata | `metadataBase` at `src/app/[locale]/layout.tsx:111`; canonicals from `localizePath()` (`src/lib/i18n/config.ts:127`); 38 files define metadata. **JSON-LD exists on one route only** (`journal/[slug]`) — no Product, Offer, Brand, Organization, WebSite or BreadcrumbList. `openGraph` in 2 files, `twitter` in 1. |
| `README.md` | 36 lines of stock `create-next-app` boilerplate. |
| `.env.local` | Clerk keys are `_test_`; **no Stripe keys present at all**; Resend key is live; one Supabase project, no staging. |

Codebase size: 553 `.ts`/`.tsx` files, ~107,863 lines, plus ~20,324 lines SQL.

---

## Decisions and assumptions

### D1 — Read-only against production (user decision)

`.env.local` points at the live Supabase project `ttekisapxjforpawnnla` and a
live Resend key. There is no staging database. Therefore, for this stage:

- **No writes of any kind** to Supabase, Clerk, Stripe, Resend or Cloudinary.
- No campaign sends, no test orders, no test rows, no seeded users.
- Verification is by reading policies, grants, function bodies and call sites,
  plus **read-only** probes with the anon/publishable key against tables that
  are already public by policy.
- Anything that can only be proven by writing is reported as
  **`UNVERIFIED — requires staging`**, never as PASS, and ships with the exact
  SQL or HTTP request that would prove it. That verdict is used honestly: it is
  not a soft PASS.

This applies to brief phases 3.6, 4 (write half), 7, 8 (attack half) and 25.

### D2 — Phases that are N/A, and why

The brief was written against an assumed stack. The real one differs:

| Brief item | Reality | Verdict |
| --- | --- | --- |
| Prisma migrations / schema | No Prisma. Raw SQL in `supabase/sql/`, applied by `scripts/db-migrate.ts` | Re-scoped, not skipped — audited as SQL |
| Tiptap rich text | Not a dependency | N/A; the real rich-text surfaces (journal, landing sections, campaign HTML) are audited in its place |
| Wishlist tables/routes | Withdrawn from the product (AGENTS.md §9) | N/A — and a FAIL if any residue is still reachable |
| Unit / integration tests | No Vitest, no Playwright, no `tests/` | N/A for "run tests"; reported as a gap, and Stage 3 decides whether to add any |
| `npm run typecheck` | No such script | Run `npx tsc --noEmit` directly; do not invent a script in this stage |
| Stripe test payment | No Stripe keys on this machine | Static analysis only; live-rail verification deferred to Stage 3 with your keys |

AGENTS.md §9 also describes Prisma models that do not exist. Where AGENTS.md and
the SQL disagree, **the SQL is authoritative** and the divergence is itself a
reported finding.

### D3 — Pre-launch cover is in scope as a security surface

`KHEM_PRELAUNCH=true`. `src/proxy.ts` gates commerce routes behind it, and
`/prelaunch` is previewable by an admin. The audit must confirm the cover is not
a *security* control being relied on (it is a marketing gate), and that
`getAdminActor()` on that path cannot be reached anonymously. Per AGENTS.md §8.1,
`src/docs/prelaunch.md` is read first and nothing there is rebuilt or changed.

### D4 — Severity scale

`CRITICAL` (unauthenticated data loss/exposure or money movement) ·
`HIGH` (cross-user access, privilege escalation, payment integrity) ·
`MEDIUM` (defence-in-depth, abuse, disclosure) · `LOW` (hygiene). No percentages.

### D5 — Phase 19.5 (SEO) becomes its own stage

The updated brief adds Phase 19.5, ~660 lines and marked mandatory. It differs
from every other phase in kind: it says *audit **and improve*** — write
structured data, repair internal linking, author entity content, add an SEO
README section. That is implementation, not findings, so it cannot sit inside a
documentation stage and it must not sit inside a read-only one.

It therefore anchors **Stage 3**, alongside Phases 18–21, and its README section
(19.5.19) is written in Stage 4 with the rest of the handbook. Stage 1 touches
SEO only where it is a *security* question — private routes leaking into the
sitemap, admin pages missing `noindex`, draft content reachable — which is
Phase 19's public-surface concern, not Phase 19.5's ranking concern.

### D6 — Nothing is claimed unrun

Every command in the report's "Verification Commands" section is one that was
actually executed, with its real exit status. A failing build is reported as a
failing build.

---

## Files likely to change

Stage 1 writes exactly one file:

- `src/docs/SECURITY-AUDIT-STAGE-1.md` — **new**

Nothing else. No source, SQL, config or `README.md` edits in this stage. Work
happens on a new branch off `main`; nothing is committed or pushed.

---

## Implementation requirements

Work phase by phase, in order. Do not skip. Every row carries `file:line`.

### Phase 0 — Architecture map
Derive from code, not from AGENTS.md. Produce the real request flow
(browser → `src/proxy.ts` → layout/page or route handler → action → service →
Supabase / Stripe / Resend / Cloudinary / AI Gateway), and name the module that
owns each hop. Explicitly record where AGENTS.md is now wrong.

### Phase 1 — Secrets
1.1 Sweep the repo (source, SQL, scripts, `public/`, `.next/`, docs, seed JSON)
for the credential classes in the brief. Confirm no server secret is named
`NEXT_PUBLIC_`.
1.2 Run `npm run build`, then grep the emitted `.next/static/**/*.js` for each
secret **by value read from `.env.local`** — never printing it. Report by
category only.
1.3 `git log -p --all` credential sweep. `.env*` add-history is already known
clean; still check for keys pasted into source, docs or SQL.
1.4 Check production output for source maps, stack traces, SQL echoes, internal
paths, debug endpoints. `src/app/design-preview/` is checked for public
reachability.

### Phase 2 — Clerk
2.1 Map `src/proxy.ts` public / authed / admin / API surface. **Confirm each API
route protects itself**, independently of the proxy — the proxy documents that
it is not the boundary, so every one of the 9 handlers is checked on its own.
2.2 For every Server Action and route handler touching customers, addresses,
orders, credits, discounts, campaigns, email or admin data, confirm identity
comes from `currentUser()`/`auth()` server-side and never from an argument.
Enumerate every action that takes an id-shaped parameter.
2.3 Confirm every module in `src/actions/admin/` calls `requireAdmin()` (or
equivalent) at the top of **every exported action** — not merely in the layout.
A layout guard protects pages, not action invocations. Any exported admin action
without its own check is a **CRITICAL** finding.
2.4 `src/app/api/webhooks/clerk/route.ts` — Svix signature verified, invalid
rejected, event types allowlisted, duplicates tolerated, payload not trusted.
2.5 Auth edge cases by reading: expired/stale session, deleted user, id
mismatch, direct API call, unauthorized mutation.

### Phase 3 — Supabase & RLS (the critical phase)
Read **all 63** migrations. Then:
3.1 Full table inventory, classified per the brief.
3.2 Every sensitive table's RLS status. RLS off is FAIL unless the table is
provably server-only *and* revoked from `anon`/`authenticated` — check
`supabase/sql/0006_privileges.sql` and every later `grant`/`revoke`.
3.3 Per-policy audit: `USING`, `WITH CHECK`, role, operation, SELECT/INSERT/
UPDATE/DELETE separately. Flag `USING (true)` on anything non-public,
unrestricted `WITH CHECK`, and client-supplied identity in a predicate.
3.4 All seven service-role call sites: why it exists, whether a browser can
reach the code path, what authorization precedes it, and whether user-controlled
input reaches a query built with it.
3.5 All ~40 `security definer` functions: pinned `search_path`, internal
authorization, dynamic SQL, injection, and — critically — **who holds EXECUTE**.
A definer function executable by `anon` is presumed a finding until the body
proves otherwise.
3.6 RLS attack matrix, per D1: for each cross-user read/update/delete the brief
lists, state the policy that stops it and cite it, or mark
`UNVERIFIED — requires staging` with the exact probe.

### Phase 4 — IDOR
Sweep every id crossing a trust boundary: route params, search params, action
arguments, form fields, cookies, client state. For each, name the server-side
ownership check. Order tokens, unsubscribe tokens, feedback links, comment ids,
credit and voucher ids get individual attention — those are the guessable ones.

### Phase 5 — Input validation & injection
Inventory every external input and its Zod schema (or absence). Check SQL/RPC
argument construction, XSS (stored and reflected), `dangerouslySetInnerHTML`
across all 553 files, HTML injection into emails, path traversal, SSRF in any
outbound fetch, open redirects in `src/lib/auth-redirect.ts` and the locale
rewrite, prototype pollution, and mass assignment in admin update actions.
Admin-authored content rendered publicly is treated as untrusted.

### Phase 6 — Stripe (static)
Server determines product, price, quantity, stock, discount validity, identity
and final amount. Webhook uses the raw body, verifies the signature, rejects
invalid, allowlists event types, and is idempotent — `supabase/sql/0054_stripe_webhook_events.sql`
is the claimed mechanism and must be read to confirm it. Confirm no browser
success redirect can mark an order paid. Document the state machine and audit
every transition. Replay analysis for duplicate orders, fulfilment, credits,
emails and stock decrements.

### Phase 7 — Inventory & concurrency
Locate the exact decrement. `supabase/sql/0042_inventory_channels.sql` is the
claimed home. Determine whether it is atomic, whether a constraint forbids
negative stock, and whether the reserve-then-sweep design in
`src/actions/checkout.ts` + `/api/cron/sweep-unpaid-orders` can double-decrement
or strand stock. Race outcomes are reasoned from the SQL and marked
`UNVERIFIED — requires staging` where a write would be needed.

### Phase 8 — Discounts, promotions, credits
Audit subscriber discount, first-subscription discount, promotions, campaign
discounts, customer credits, discovery credit, redemption, grants, expiry,
one-time use and stacking. Confirm every monetary calculation is server-side.
Analyse reuse, duplicate redemption, negative quantity/credit, substituted
customer or discount id, expired discount, excluded product, concurrent
redemption.

### Phase 9 — Resend / email
Full email inventory per the brief's ten fields. Confirm the key is server-only,
recipients are never caller-chosen, campaign sending is admin-only, HTML escapes
user values, unsubscribe tokens are unforgeable (`src/actions/unsubscribe.ts`,
`src/app/[locale]/unsubscribe/`), unsubscribe actually suppresses future
marketing, and duplicate sends are bounded. **Nothing is sent.**

### Phase 10 — Cloudinary / uploads
Locate every upload path — comment images (`supabase/sql/0018_comment_rating_images.sql`,
`src/lib/comment-images.ts`) and any admin media. Check type/MIME/extension
validation, size and dimension limits, filename handling, signing, and
public/private policy. Malicious-file tests are described, not executed.

### Phase 11 — Public forms & abuse
Newsletter, contact, comments, search, checkout intent, cron endpoints.
Rate limiting, validation, spam protection, body size, duplicate submission,
safe error text. Absence of rate limiting is a finding with a severity, not a
silent pass.

### Phase 12 — Security headers
Already known: **no headers are configured anywhere**. Enumerate what is missing,
and propose a CSP that provably does not break Clerk, Stripe Elements,
Cloudinary, Supabase Storage, `next/image` or the AI Gateway — derived from the
actual third-party origins in the codebase. Proposed only; applied in Stage 2.

### Phase 13 — CSRF
Determine whether Next 16 Server Action origin checking plus Clerk's cookie
policy is sufficient for each cookie-authenticated mutation, and whether any
route handler performs a state change reachable by a cross-site form post.

### Phase 14 — Errors & disclosure
Read every `catch`. Find swallowed errors, leaked internals in user-facing text,
and secrets or PII in `console.*` output that reaches Vercel logs.

### Phase 15 — Dependencies
`npm audit`, `npm outdated`. Classify per the brief: security-critical /
recommended / safe to defer / breaking. Nothing is upgraded in this stage.

---

## Security requirements

- No secret value is ever printed, logged, or written into the report — category
  and location only.
- No write to any live service. No email sent. No campaign dispatched.
- Test accounts are not created, because creating one is a write to production.
- Security is never weakened to obtain a PASS.
- The report contains no fabricated `file:line` — every citation is checked.
- Existing KHEM behaviour and design are described, not altered.

---

## Acceptance criteria

1. `src/docs/SECURITY-AUDIT-STAGE-1.md` exists and covers Phases 0–15, each with
   the brief's table format: `| Item | Status | File / Line | Finding | Fix Applied |`.
   Stage 1's "Fix Applied" column reads `PROPOSED — Stage 2` throughout.
2. Every PASS carries concrete evidence. Every FAIL carries a reproducible
   finding. Every N/A carries a reason. Every `UNVERIFIED` carries the exact
   probe that would settle it.
3. All 63 SQL migrations are read; the table inventory is complete.
4. All 9 API routes, all 33 action modules and all 7 service-role call sites are
   individually accounted for.
5. Findings are ranked by severity with an executive summary at the top.
6. Every proposed fix is specific — file, line, and the change — so Stage 2 is
   execution, not rediscovery.
7. `git status` shows exactly one new file. `git diff` is empty.
8. Verification Commands lists only commands actually run, with real results.

---

## Checks to run

Real commands, real output recorded:

```bash
npx tsc --noEmit          # no typecheck script exists; this is the check
npm run lint
npm run build             # also produces the bundle for Phase 1.2
npm audit
npm outdated
git status --porcelain    # must show only the new report file
```

`npm run db:verify` is read-only per `scripts/db-verify.ts` — it is inspected
first and run only if that holds.

---

## Manual test steps expected after this stage

Stage 1 ships a document, so verification is reading it:

1. `git status` — one new untracked file, `src/docs/SECURITY-AUDIT-STAGE-1.md`,
   on a fresh branch. No other change.
2. Open the report; read the executive summary and the severity table.
3. Spot-check five citations at random — open each `file:line` and confirm the
   quoted code says what the finding claims.
4. Confirm no secret value appears anywhere in the document.
5. Review the `UNVERIFIED — requires staging` list and decide whether to
   provision a staging Supabase project before Stage 2.
6. Approve, amend or reject each proposed fix. That approved list becomes
   `prompts/security-audit-stage-2-fixes.md`.

---

## Out of scope for Stage 1 (later stages)

- **Stage 2** — apply the approved fixes, re-test each one, then Phases 16–17
  (build / lint / typecheck, functional regression).
- **Stage 3** — Phases 18–21 plus **Phase 19.5 in full**: mobile QA, public
  surface, the complete SEO audit *and* its improvements (sitemap, robots,
  canonical strategy, structured data, entity/brand consistency, internal
  linking, product and image SEO, heading semantics, AI-search readiness,
  crawlability, indexability table, Core Web Vitals, SEO regression checks),
  code-quality sweep, and the hardcoded/CMS/environment inventory.
- **Stage 4** — Phases 22–25: database documentation, email documentation, the
  full `README.md` handbook including the §19.5.19 SEO section, the final
  adversarial review, and the closing report against both Definitions of Done.

Both the main Definition of Done and the SEO Definition of Done are checked off
in Stage 4, against evidence, not against having performed the audit.
