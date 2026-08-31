# KHEM — Admin Dashboard & CMS Audit Report

**Phase 1–2 deliverable of `ADMIN-CMS-FINAL-ARCHITECTURE.md`. Audit only — no code, schema or data was changed to produce this.**

Date: 2026-08-30

---

## 1. Current structure

### 1.1 Sidebar — 17 flat rows, no grouping

`src/components/admin/AdminShell.tsx:70–99` defines a single flat `SECTIONS` array, deliberately ordered by how often a desk reaches for each row rather than by how the tables relate:

```
Dashboard · Orders · Customers · Credits · Discounts · Promotions ·
Announcements · Newsletter · Campaigns · Inventory · Analytics ·
Collections · Products · Journal · Content · Stockists · Settings
```

There is no second level anywhere in the rail. Every route below the top level is reached from inside a page.

### 1.2 Routes — all 17 exist, all under `src/app/[locale]/admin/`

Every rail row maps 1:1 to a real directory. Sub-routes that exist but are not in the rail:

| Parent | Sub-routes |
| --- | --- |
| orders | `[orderNumber]`, `new` |
| products / collections / journal / stockists / discounts | `[slug]`/`[id]`/`[code]`, `new` |
| campaigns / announcements / promotions | `[id]`, `new` |
| customers / credits | `[id]` |
| **content** | `ingredients`, `ingredients/[slug]`, `ingredients/new` |

`/admin/content` is the only route with a nested CMS-shaped child today.

### 1.3 Current CMS surface

| Screen | Feeds | Backed by |
| --- | --- | --- |
| `/admin/content` | /heritage, /craftsmanship, /about | `TimelineEvent`, `BrandValue`, `CraftPillar`, `CraftStep`, `CraftStat`, `CraftQuote`, `MissionStatement` |
| `/admin/content/ingredients` | /ingredients | `Ingredient`, `IngredientFamily`, `IngredientUsage` |
| `/admin/journal` | /journal | `Article` |
| `/admin/collections` | /collections, /collections/[slug] | `Collection`, `MerchPage` |
| `/admin/settings` | home featured section, /contact, email signatures | `BoutiqueSetting`, `ContactChannel`, `SocialProfile` |

All of these already read/write Arabic twin columns (`*_ar`, established by `supabase/sql/0008_i18n_content.sql`), resolved with English fallback.

### 1.4 Database — 48 tables across 34 migration files

`supabase/sql/0001…0035`. Catalog, content, directory, search, orders, checkout, customers, newsletter, credits, discounts, notifications, campaigns, marketing/promotions. Applied by `npm run db:migrate` (idempotent, one transaction).

**The schema is in good shape. Nothing in this reorganisation requires restructuring it.**

---

## 2. Problems found

### P1 — The rail is a flat list of 17 tables, not a list of jobs
A new team member reads it as "which table am I in?". Marketing alone occupies 6 of the 17 rows (Credits, Discounts, Promotions, Announcements, Newsletter, Campaigns), scattered between Orders and Inventory.

### P2 — Content is split three ways with no page-shaped entry point
Journal is a top-level row; Ingredients is buried two levels inside Content; heritage/craftsmanship/about copy is one long scrolling page of seven row-editors; the home page's featured product is in **Settings**. There is nowhere to answer "I want to edit the Heritage page."

### P3 — Promotions is written in Campaign language
`Promotion` (a price the catalogue carries) and `Campaign` (an email) are correctly separate *systems* — `supabase/sql/0035_marketing.sql:9–21` argues the separation explicitly — but the Promotions UI calls its records campaigns:

- `src/app/[locale]/admin/promotions/page.tsx:72` — button `New campaign`
- `:79` — empty state "No promotional campaigns yet"
- `:82` — `Create the first campaign`
- `:89` — table column header `Campaign`
- `src/components/admin/PromotionForm.tsx:241` — section heading `The campaign`
- `:277`, `:286` — `Campaign label — English / Arabic`
- `:406` — `Save campaign` / `Create campaign`
- `:261`, `:325`, `:391`, `:398`, `:422–424` — prose using "campaign"
- `src/app/[locale]/admin/promotions/new/page.tsx:40`, `[id]/page.tsx:47` — same

Note `Campaign label` is a real customer-facing field (the banner text printed on a product card). Renaming it needs the *feature* name, not a find-and-replace — proposed: **Badge label**.

### P4 — Campaign sending has one audience and no confirmation of who
- `src/components/admin/CampaignDispatch.tsx:129` — the button is `Send Now`.
- The audience is hard-wired in SQL: `claim_campaign_audience()` (`0034_campaign_dispatch.sql:97–105`) claims exactly `NewsletterSubscriber where status='SUBSCRIBED' and locale = campaign.locale`. `campaign_audience_count()` (`0033_campaigns.sql:219–229`) repeats the same predicate so the number shown and the number sent cannot diverge.
- There is no customers audience, no specific-addresses mode, and no dedup logic because there is currently only one source.
- The existing arm-then-confirm flow **already states the recipient count** before sending, and `dispatchCampaign()` claims under a row lock so a double-press sends nothing twice. This is good and must be preserved, not replaced.

### P5 — Landing page and page-hero copy are not in the CMS at all
`src/app/[locale]/page.tsx` and every World-of-KHEM page read their headings, eyebrows, body copy, CTAs and **all SEO metadata** from `src/lib/i18n/dictionaries/en.ts` (1,898 lines) and `ar.ts` (1,627 lines) via `getDictionary()`. The database supplies only the repeatable rows (timeline events, pillars, ingredients, articles, products) and the featured-product slug.

So today: a section's *rows* are editable by the team; the section's *title, intro and SEO* require a developer and a deploy.

### P6 — No editable SEO anywhere
All `generateMetadata()` calls resolve from the dictionaries (`localeMetadata()`). No table holds a per-page SEO title / description / OG image.

### P7 — `npm run db:seed` has no environment guard
`scripts/db-seed.ts` is genuinely safe by construction — one transaction, upsert-only, **no drop / truncate / delete**, every value bound. But it has *no* check on which database it is pointed at. Run against production with a stale `DATABASE_URL`, it would **overwrite** live edited content with the frozen JSON export. It cannot delete, but it can clobber.

Also noted: two historical `delete from` statements exist in migrations (`0019_gourmand_family.sql:39`, `0021_retire_limited_edition.sql:33`) — intentional one-off data corrections, idempotent, no action needed.

---

## 3. Proposed final sidebar

```text
Dashboard

COMMERCE
├── Orders
├── Customers
├── Products
├── Collections
├── Inventory
└── Stockists

MARKETING
├── Promotions
├── Discounts
├── Credits
├── Campaigns
├── Newsletter
└── Announcements

CONTENT
├── Landing Page
└── World of KHEM
    ├── Heritage
    ├── Craftsmanship
    ├── Ingredients
    ├── Journal
    └── About KHEM

ANALYTICS
└── Analytics          ← single existing screen; do not split into empty pages

SYSTEM
└── Settings
```

**Route policy: no existing route is renamed or deleted.** The rail gains grouping and a second level; `/admin/journal`, `/admin/content/ingredients` and the rest keep their URLs, so 110 in-code references, bookmarks and redirects all stay valid. New routes are added only where a new screen genuinely exists:

- `/admin/content` — becomes a hub listing Landing Page and World of KHEM
- `/admin/content/heritage`, `/craftsmanship`, `/about` — the three row-editor groups currently stacked on one page, split onto the page they feed
- `/admin/content/landing` — new
- `/admin/content/ingredients`, `/admin/journal` — **unchanged**, linked from the hub

Analytics is deliberately *not* expanded into Sales/Customers/Products/Marketing/Reports: four of those five screens do not exist, and the architecture doc says not to create empty pages.

---

## 4. Database impact

### Reused unchanged (no migration)
Everything behind Commerce, Content, Analytics and Settings. The whole navigation reorganisation is **pure UI** — zero migrations, zero data movement.

### One migration genuinely required — campaign audiences

The campaign work cannot be done in UI alone. `campaign_sends` is keyed on a subscriber:

```sql
"subscriberId" text not null references "NewsletterSubscriber"(id)
primary key ("campaignId", "subscriberId")
```

A customer or a manually typed address has no subscriber row, so today it is **impossible to record that a letter was sent to one**. Proposed additive migration `0036_campaign_audiences.sql`:

1. `campaigns` — add `"toSubscribers" boolean not null default true`, `"toCustomers" boolean not null default false`. Existing rows keep today's behaviour exactly.
2. `campaign_recipients` — new table for Mode B (specific addresses): `campaignId`, `email`, unique on `(campaignId, lower(email))`.
3. `campaign_sends` — add `email text` and `"recipientKind"` (`SUBSCRIBER` | `CUSTOMER` | `SPECIFIC`); make `subscriberId` **nullable**; move the primary key to `(campaignId, lower(email))` so **deduplication is enforced by the database**, not by application code. Backfill `email` and `recipientKind='SUBSCRIBER'` for existing rows before the key change — no history is lost.
4. `claim_campaign_audience()` — replace to union the selected sources with `on conflict do nothing` on the new key. One statement, one transaction, as today.
5. `campaign_audience_count()` — replace to take the two flags and return the **deduplicated** count, so the number shown and the number sent still come from one definition.
6. `next_campaign_chunk()` — must return an unsubscribe token for every recipient kind. Today it returns the subscriber row's token. **Open question below.**

**Consent is already modelled.** `"User"."marketingOptIn"` / `"marketingOptInAt"` exist (`0024_customers.sql:69–71`, moved only through `set_marketing_opt_in()` in `0032`). The Customers audience must filter on `marketingOptIn = true` — anything else emails people who declined.

**Preserved:** `guard_campaign_edit()` (blocks editing a sent campaign), the DRAFT/SENDING/SENT/FAILED states, `audienceCount` snapshots, every existing `campaign_sends` row, the row-lock claim, and the arm-then-confirm dispatch UI.

### Deferred, needs your decision — landing page & SEO CMS (P5/P6)
Making the dictionary copy editable is a **second project**, not a sub-task of this one. It means moving ~3,500 lines of typed, interpolated, RTL-aware copy out of TypeScript and into tables, and every page's `generateMetadata()` with it. Recommendation: **ship the reorganisation, campaigns and terminology first**, then scope the landing-page CMS separately. See the question below.

### Production safety
Add an explicit environment guard to `scripts/db-seed.ts` — refuse to run when the target host is not localhost/a known dev project unless `KHEM_SEED_CONFIRM=<db host>` is set. Small change, closes the only real production-data risk found.

---

## 5. Implementation order (once approved)

1. Sidebar grouping — UI only, no route changes.
2. Content hub + Heritage / Craftsmanship / About / Landing Page split (Landing Page screen surfaces what is *already* DB-backed and states plainly what is not).
3. Promotions terminology.
4. `0036_campaign_audiences.sql` + audience selection, Send Specific, dedup, confirmation summary.
5. `db-seed.ts` production guard.
6. EN/AR + RTL verification, unauthorised-access check, `npm run lint`, `npx tsc --noEmit`.

---

## 6. Decisions taken

1. **Unsubscribe for non-subscriber recipients — per-send token.** Each `campaign_sends` row carries its own random token, so a customer or a typed address gets a working link without being enrolled in a list they never joined. Following it suppresses the address for every future campaign and, when the row was a subscriber's, unsubscribes them from the list as well. Older links carrying subscriber tokens keep working — `unsubscribeByToken()` tries that first.

2. **Landing-page CMS — deferred.** Shipped with what is already database-backed. `/admin/content/landing` lists every band of the home page and names where each is edited, marking the code-owned copy plainly rather than showing boxes that cannot publish.

---

## 7. Implemented

Everything in §5 is done, typechecked, linted and built. Two things to know:

- **The migration has not been applied.** There is no local Postgres on this machine and `SUPABASE_DB_URL` points at a remote database, so running DDL against it was left to you: `npm run db:migrate`. It is additive, idempotent and runs in one transaction.
- **`Testimonial` has no admin editor.** It is database-backed and on the home page, but no columns, service or actions exist for it — it is changed in Supabase directly today. A worthwhile follow-up, out of scope here.

---

## 8. Phase 13 — deployment readiness

Run 2026-08-31, against the live database after `0036_campaign_audiences.sql`. Every probe wrote inside a transaction that rolled back, or was deleted afterwards; the final state was checked back to the row counts it started with.

### Verified

| Area | Evidence |
| --- | --- |
| **Database** | Migration applied. 33 structural checks: `campaign_sends` re-keyed to `(campaignId, email)`, `subscriberId` nullable, both audience flags defaulting to today's behaviour, superseded functions dropped, the edit guard extended. Both pre-existing send rows preserved, backfilled, each with a distinct token. |
| **Deduplication** | A synthetic consenting customer sharing an address with a subscriber: both audiences selected gives **3 recipients, not 4**. The claim writes `SUBSCRIBER=2, CUSTOMER=1`. A second dispatch claims 0. |
| **Consent** | A customer who declined never enters the audience. Suppressed addresses are dropped from every source including hand-typed ones. |
| **Unsubscribe** | End-to-end in a browser: the confirm page renders, the button writes, the page reports "You have been removed.", the address is suppressed. A second click is idempotent. Unknown tokens are refused. Subscriber tokens still resolve first, so links already in inboxes keep working. |
| **Validation** | Invalid addresses refused; duplicates differing only in case refused; the 200-address cap enforced; an empty list allowed. |
| **Security** | Every admin route — including the five new Content screens — redirects an anonymous request to sign-in, in both locales. The anon key is refused (`42501`) on `campaign_recipients`, `email_suppressions`, `campaign_sends`, `campaigns` and `User`, for reads and writes, and on all five new functions. Public content tables still read normally, so nothing was over-tightened. |
| **Localization** | `/heritage` and `/ar/heritage` both render six timeline entries; the Arabic page renders its own heading and RTL. |
| **Production safety** | `npm run db:seed` refuses a non-local target unless its host is named. The migration is additive, idempotent, and runs in one transaction — proved by the failed first run rolling back completely. |
| **Performance** | No new query per row: the audience is one function, counted once, claimed in one statement. `getCampaign()` gained two reads. |

### Not verified — needs a signed-in browser

Clerk blocks automated sign-in, so these are untested by machine:

- The rail's grouping and second level as rendered.
- Editing content and seeing it change on the public page (the read path is proven; the write path through the new screens is not).
- The Landing Page and World of KHEM screens visually.
- Promotion terminology on screen (verified by source inspection only).
- Campaign audience selection, Send Specific and the confirmation summary **through the UI** — the engine beneath them is proven, the screens are not.
### Confirmed by a real send

A live campaign — "REFUND COUPON 890 EGP" — was sent by hand on 2026-08-31 and the database recorded it correctly:

```
campaigns:       SENT  en  toSubscribers=false toCustomers=false  audienceCount=1
campaign_sends:  SPECIFIC  delivered=true  error=none  subscriberId=NULL
```

This is the path that was **impossible before `0036`**: a recipient with no subscriber row could not be recorded at all, because `campaign_sends` was keyed on `subscriberId` with a not-null foreign key. The whole chain ran — claim, compose with a per-send unsubscribe token, send, record, finish — and the campaign moved to SENT with an audience of exactly one.

It also validates the Mode B deviation noted in §6: both audience toggles off plus one named address does behave as "send only to these people", and reads that way in use.

The earlier campaign's two `SUBSCRIBER` rows survived the re-key intact and are still marked delivered. No address in any campaign has more than one send row.

### Known, unchanged

- `npm run db:verify`: `CraftQuote — expected 1, found 2`. A quote was added through the dashboard and `supabase/seed/catalog.json` is stale. `npm run db:dump` reconciles it. Pre-existing.
- Clerk logs "instance keys do not match" on this environment. Did not affect any check above; worth resolving before deploying.
