# Prompt — Admin Dashboard Reorganisation, CMS Structure, Campaign Audiences, Promotion Terminology

## Goal

Execute Steps 3–7 of `src/docs/ADMIN-CMS-FINAL-ARCHITECTURE.md`, against the findings in `src/docs/ADMIN-CMS-AUDIT-REPORT.md`:

1. Group the flat 17-row admin rail into Dashboard / Commerce / Marketing / Content / Analytics / System.
2. Give Content a page-shaped structure (Landing Page, World of KHEM → Heritage, Craftsmanship, Ingredients, Journal, About KHEM).
3. Correct Promotion vs Campaign terminology.
4. Add campaign audience selection (Subscribers / Customers), Send Specific, database-enforced deduplication, and a confirmation summary.
5. Add a production guard to `npm run db:seed`.

## Skills read

- `AGENTS.md`, `supabase/AGENTS.md`
- `src/docs/ADMIN-CMS-FINAL-ARCHITECTURE.md`, `src/docs/khem-ui-design-system.md`
- `.agents/skills/supabase` (migrations, RLS, service-role usage, dedupe)
- `.agents/skills/clerk` (admin authorisation)

## Existing code inspected

`src/components/admin/AdminShell.tsx`, `CampaignDispatch.tsx`, `CampaignForm.tsx`, `PromotionForm.tsx`, `ContentRowsEditor.tsx`, `HouseSettingsForm.tsx`; every route under `src/app/[locale]/admin/`; `src/services/admin/*`, `src/actions/admin/*`; `supabase/sql/0024`, `0025`, `0032`, `0033`, `0034`, `0035`; `scripts/db-seed.ts`, `scripts/db-migrate.ts`; `src/lib/i18n/dictionaries/{en,ar}.ts`.

## Decisions / assumptions

- **No existing admin route is renamed or deleted.** 110 in-code references stay valid. New routes are added only for screens that genuinely exist.
- Analytics stays one screen. No empty pages.
- `/admin/journal` and `/admin/content/ingredients` keep their URLs and are linked from the Content hub.
- `Campaign label` on a promotion is renamed **Badge label** (it is the banner printed on a product card) — a rename of the label, not the column.
- Customers audience filters on `"User"."marketingOptIn" = true`. Non-consenting customers are never emailed.
- Deduplication is enforced by the database primary key, not by application code.
- Landing-page/SEO copy currently in the dictionaries is **out of scope** (see report §4, open question 2). The Landing Page screen surfaces what is already DB-backed and states plainly which sections are code-owned.

## Files likely to change

**Navigation** — `src/components/admin/AdminShell.tsx` (grouped `SECTIONS`, group headings, expand/collapse, active-section resolution, drawer + collapsed-rail behaviour preserved).

**Content** — `src/app/[locale]/admin/content/page.tsx` (becomes a hub); new `content/landing/page.tsx`, `content/heritage/page.tsx`, `content/craftsmanship/page.tsx`, `content/about/page.tsx`. Editors move; no service or action signatures change.

**Promotions** — `src/app/[locale]/admin/promotions/{page,new/page,[id]/page}.tsx`, `src/components/admin/PromotionForm.tsx`.

**Campaigns** — `supabase/sql/0036_campaign_audiences.sql` (new); `src/services/admin/campaigns.ts`, `campaign-dispatch.ts`; `src/actions/admin/campaigns.ts`; `src/components/admin/CampaignDispatch.tsx`, `CampaignForm.tsx`; `src/schemas/admin.ts`, `src/schemas/db/*`; `src/types/campaign.ts`; `src/app/api/cron/send-campaigns/route.ts`.

**Safety** — `scripts/db-seed.ts`.

## Implementation requirements

### 1. Sidebar
Grouped, with uppercase group headings in the existing rail type scale. Collapsed-rail, mobile drawer, `localStorage` key, RTL transforms and `aria-current` behaviour all preserved exactly. Content's five World-of-KHEM children appear as a second level.

### 2. Content
`/admin/content` becomes a hub of two cards — Landing Page, World of KHEM — using the existing bordered-card pattern already in that file. World of KHEM lists Heritage, Craftsmanship, Ingredients, Journal, About KHEM. Each page keeps the existing `ContentRowsEditor` usage verbatim; only which page renders which editor changes. Arabic-twin fields and English fallback untouched.

### 3. Promotions terminology
Replace every "campaign" in the Promotions UI with "promotion" (report §P3 lists each line). Do not touch `src/app/[locale]/admin/campaigns/**` or the `campaigns` table.

### 4. Campaigns

Migration `0036_campaign_audiences.sql` — additive, idempotent, one transaction, matching the house style of 0033–0035:
- `campaigns`: `"toSubscribers" boolean not null default true`, `"toCustomers" boolean not null default false`.
- `campaign_recipients` (new): `campaignId` FK cascade, `email`, unique `(campaignId, lower(email))`.
- `campaign_sends`: add `email text`, `"recipientKind"` enum; `subscriberId` nullable; **backfill existing rows first**, then move the PK to `(campaignId, lower(email))`.
- Replace `claim_campaign_audience()` — union of selected sources + `campaign_recipients`, `on conflict do nothing`, still one statement under the existing row lock.
- Replace `campaign_audience_count()` — takes the flags, returns the deduplicated count.
- `next_campaign_chunk()` — return a working unsubscribe token for every recipient kind (per-send token; do not auto-enrol customers into the Inner Circle list).
- RLS/privileges: revoke from `public`, `anon`, `authenticated`, matching 0033.

UI: audience checkboxes (Subscribers checked by default, Customers optional); a Send Specific mode with add/remove email rows, Zod validation, duplicate rejection, live recipient count; a confirmation summary stating per-source counts and the total unique figure before the irreversible action. Keep the existing arm-then-confirm pattern — extend it, do not replace it.

Preserve: `guard_campaign_edit()`, DRAFT/SENDING/SENT/FAILED, `audienceCount` snapshots, every existing `campaign_sends` row, the row-lock claim, scheduling.

### 5. Seed guard
`scripts/db-seed.ts` refuses to run against a non-local host unless `KHEM_SEED_CONFIRM` matches that host. Printed message names the host (redacted credentials, as `redactUrl` already does).

## Security requirements

- No new route or action bypasses `requireAdmin()`; every new action re-checks it.
- Campaign sending stays service-role only and unreachable from the browser.
- Subscriber addresses and unsubscribe tokens are never logged.
- Customers audience gated on `marketingOptIn`.
- No RLS policy is weakened; no new grant to `anon` or `authenticated`.

## Acceptance criteria

- Rail shows the six groups; every previously reachable screen is still reachable; no 404 from any existing link or bookmark.
- Content hub → World of KHEM → each of the five pages works; editing a row still changes the matching public page in EN and AR.
- No "campaign" wording remains in the Promotions UI; Campaigns UI untouched.
- Campaign sends to: Subscribers only, Customers only, both (an address on both lists receives exactly one letter), and Send Specific (only the typed addresses). Confirmation summary precedes every send.
- Existing campaign history, statuses and counts unchanged after migration.
- `npm run db:seed` refuses a non-local target without the confirm variable.
- `npm run lint` and `npx tsc --noEmit` clean.

## Checks to run

`npx tsc --noEmit` · `npm run lint` · `npm run db:migrate` (dev database) · `npm run db:verify`

## Manual test steps

1. `npm run dev`; sign in as admin; open `/en/admin` — walk every group and every row.
2. `/en/admin/content` → World of KHEM → Heritage: edit a timeline event, save, load `/en/heritage` and `/ar/heritage`; confirm RTL and the Arabic fallback.
3. `/en/admin/promotions` and a promotion detail — read every label; confirm no "campaign".
4. Create a draft campaign. Tick Subscribers only → confirm the count matches `/en/admin/newsletter`. Tick both → confirm the total is the deduplicated union, not the sum. Use Send Specific with a duplicate and an invalid address → both rejected.
5. Send a small test campaign; confirm the sent record, the counts, and that the campaign can no longer be edited.
6. Sign out; request `/en/admin` → 404, not a redirect that confirms the route.
7. Point `DATABASE_URL` at a non-local host and run `npm run db:seed` → refuses.
