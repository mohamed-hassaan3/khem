# Security Audit — Stage 2: Apply Fixes (+ Phases 16–17)

Source: `src/docs/SECURITY-AUDIT-STAGE-1.md` (findings F1–F12).
Brief: `src/docs/KHEM_FINAL_SECURITY_QA_AND_DEVELOPER_HANDOFF.md`.

Stage 2 of 4. Approved by the user after reviewing Stage 1.

---

## Goal

Apply the fixes for F1–F11, re-test each, then run Phases 16–17 (build / lint /
typecheck, functional regression). Every change stays in the working tree on
`security-audit-stage-1`; **nothing is committed or pushed**.

---

## Decisions carried forward

### D1 — still no writes to production

Unchanged from Stage 1. In particular:

- The F4 migration is **written as a file, not applied**. `supabase/sql/*.sql`
  is inert until somebody runs `npm run db:migrate`; that run is the user's, not
  this stage's. The same holds for the F10/F11 migration.
- No email, no campaign, no Stripe call, no test row.
- `npm run db:verify` still writes probe rows — still not run.

### D2 — F4 caveat resolved, fix is safe

Stage 1 flagged that `security_invoker = on` might break admin reads of the three
views. Verified since: all three are read **exclusively** through
`getSupabaseAdmin()` — `src/services/credits.ts:40`, `src/services/rewards.ts:58`,
`src/services/admin/customers.ts:74`, `src/services/admin/campaigns.ts:41`.
`service_role` bypasses RLS whether the view is invoker or definer, so behaviour
is unchanged. The fix closes the latent hazard without touching current reads.

### D3 — F1 gets a shared helper, not an inline patch

The one-line `.replace()` would fix today's single call site. Stage 3
(Phase 19.5.6) adds Product, Offer, Organization, WebSite and BreadcrumbList
JSON-LD across the catalogue, so the escape belongs in one reusable place that
those pages import — otherwise the same defect is re-introduced five times by
the next stage.

### D4 — CSP ships Report-Only

Per the brief's *"do not add headers blindly if they break Clerk, Stripe,
Cloudinary… "*. `Content-Security-Policy-Report-Only` collects violations
without enforcing. Flipping to enforcing is a one-word change the user makes
after watching the console on a preview deploy. The other five headers are
enforced immediately — none of them can break a working page.

### D5 — F12 deferred

AGENTS.md corrections land in Stage 4 with the README, as Stage 1 proposed.

---

## Files that will change

| File | Change | Finding |
|---|---|---|
| `src/lib/json-ld.ts` | **new** — `jsonLdScript()` escaping helper | F1 |
| `src/app/[locale]/journal/[slug]/page.tsx` | use the helper | F1 |
| `package.json`, `package-lock.json` | `next` + `eslint-config-next` → 16.3.4 | F2 |
| `next.config.ts` | `headers()` block | F3 |
| `supabase/sql/0064_security_hardening.sql` | **new, not applied** — views + function revokes + `search_path` | F4, F10, F11 |
| `src/app/api/checkout/intent/route.ts` | rate limit | F5 |
| `src/app/design-preview/` | **deleted** | F6 |
| `src/docs/Temporary-Pre-Launch-Cover.md` | correct the `NEXT_PUBLIC_` guidance | F7 |
| `supabase/sql/0006_privileges.sql` | correct the "applied last" comment | F8 |
| `src/lib/supabase.ts` | correct the caller list | F9 |

---

## Implementation requirements

Ordered as Stage 1 recommended. F1 first, because it gates Stage 3.

1. **F1** — `src/lib/json-ld.ts` exporting a function that returns the escaped
   string for `dangerouslySetInnerHTML`. Escape `<` as `<` (valid JSON,
   parses back identically). Apply at `journal/[slug]/page.tsx:128`. Document
   *why* — the existing comment claims `JSON.stringify` is sufficient and must be
   corrected, not left standing beside the fix.
2. **F2** — `npm install next@16.3.4 eslint-config-next@16.3.4`. Re-run
   `npm audit` and confirm 0 high. Re-run build, lint, typecheck.
3. **F6** — `rm -rf src/app/design-preview/`. Confirm nothing imports from it.
4. **F3** — `headers()` in `next.config.ts`: CSP Report-Only, plus enforced
   `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
   `X-Frame-Options`, `Strict-Transport-Security`. CSP sources derived from the
   repository's actual origins, not a template.
5. **F4/F10/F11** — one migration, `0064_security_hardening.sql`: three
   `alter view … set (security_invoker = on)`, five function revokes, one
   `search_path` pin. Written, not applied.
6. **F5** — apply the existing `isRateLimited` to `/api/checkout/intent`.
7. **F7/F8/F9** — comment and doc corrections.
8. Re-run the whole verification suite (Phase 16).
9. Phase 17 functional regression, to the extent it can be done without writes.

---

## Security requirements

- No fix weakens an existing control.
- No secret printed or written.
- No production write; the migration is a file only.
- Existing KHEM behaviour and design preserved — these are security fixes, not a
  refactor. The luxury UI is not touched.
- Every claim of "fixed" is backed by a re-run check.

---

## Acceptance criteria

1. F1–F11 each either fixed, or explicitly recorded as deferred with a reason.
2. `npm audit` reports **0 high**.
3. `npm run build`, `npx tsc --noEmit`, `npm run lint` all exit 0 **after** the
   changes.
4. The F1 fix is proven: the breakout payload no longer escapes the script tag.
5. The migration file exists, is valid SQL, and is **not applied**.
6. `git status` shows only intended files; nothing committed or pushed.
7. `src/docs/SECURITY-AUDIT-STAGE-2.md` records what changed, with before/after
   evidence per finding.

---

## Checks to run

```bash
npm audit                 # must reach 0 high
npx tsc --noEmit
npm run lint
npm run build
git status --porcelain
```

---

## Manual test steps expected after this stage

1. `git diff` — review every change; nothing is committed.
2. Confirm `npm audit` reports 0 high.
3. Apply the migration when ready: `npm run db:migrate` (it prints "PostgREST
   schema cache reload signalled" — required per AGENTS.md §9).
4. Deploy to a **preview**, open the browser console, and watch for CSP
   Report-Only violations across: home, a product page, cart, checkout with card,
   sign-in, and `/admin`.
5. When the report is clean, rename the header to `Content-Security-Policy` to
   enforce.
6. Confirm `/design-preview` now 404s.

---

## Out of scope

- **Stage 3** — Phases 18–21 + 19.5 (SEO audit and improvements).
- **Stage 4** — Phases 22–25, README, final adversarial review, both Definitions
  of Done.
