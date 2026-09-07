# KHEM — Audit Stage 4: Documentation & Final Adversarial Review (Phases 22–25)

> Executed 2026-09-07 on branch `security-audit-stage-1`.
> Closes the audit begun in `SECURITY-AUDIT-STAGE-1.md`.
> Nothing committed or pushed. No production write at any point in four stages.

---

## Final security status: **MEDIUM — CLEAN once `0065` is applied**

Per the brief's closing rule, the project is not marked CLEAN/READY merely
because the audit was performed.

- Every **security** finding raised across four stages is fixed or accepted.
- **F15 is FIXED and APPLIED.** `supabase/sql/0065_restore_catalog_rpcs.sql`
  was applied to production on 2026-09-07 and verified live with the
  publishable key. The related-products rail renders again and search now ranks
  in Postgres instead of falling back to in-memory JavaScript. The final build
  prints **0** failures, down from 60.
- **`0064` is applied** (2026-09-07): all seven views are `security_invoker`,
  the five trigger functions are revoked from `anon`, and **zero**
  `SECURITY DEFINER` functions have an unpinned `search_path`.
- **The CSP is enforcing**, promoted only after a real browser measured 14
  routes plus a full Stripe.js load and reported zero violations.
- **F17** (build flakiness) remains open by choice; it needs a decision about
  build-phase timeout behaviour, not a bug fix.

One follow-up remains before search is fully what it was designed to be:
**0 of 31 products carry an embedding** (`Product.embedding`), and 0 of 6
articles. `hybrid_search_products` therefore contributes full-text ranking only
— its semantic half has nothing to match against. That is not part of F15 and
was never caused by it; it needs `npm run embed` against production. Until then
`/api/search` correctly reports `mode: "lexical"`.

Status becomes CLEAN when `0064` is applied and a deployed preview is confirmed.

### F15 resolution — what the test actually showed

The Stage 3 recommendation (**"Option 1 is almost certainly right"**) was
**wrong**, and the test disproved it. Marking the functions `security definer`
does restore them — and hands `anon` the margin:

```
as anon:  select slug, "costInCents" from <definer probe>()
       → {"slug":"sunlit-citrine","costInCents":60000}
```

The shipped fix keeps `setof "Product"` (PostgREST embedding survives), takes
`security definer` (the function can read the row), and strips the cost from the
output **by name**:

```sql
jsonb_populate_record(null::public."Product", to_jsonb(p) - 'costInCents')
```

Dry-run of the real migration, as `anon`, inside a rolled-back transaction:

| Check | Before | After |
|---|---|---|
| `related_products` | `42501 denied` | **OK — 3 rows** |
| `hybrid_search_products` | `42501 denied` | **OK — 3 rows** |
| `costInCents` on the one product that has one (60000) | n/a | **`null` — masked** |
| Archived products in search results | n/a | **0 — still hidden** |
| Public columns (`slug`, `name`, `priceInCents`, `inventory`) | n/a | **intact** |

The archived check matters: `security definer` bypasses RLS, so the
`isArchived`/`deletedAt` predicates already inside both function bodies become
load-bearing rather than belt-and-braces. The migration says so at the top.

---

## Phase 22 — Database documentation

**71 tables · 7 views · ~103 functions · 14 triggers · 97 indexes · 64 migrations.**

Schema source of truth: `supabase/sql/`, applied in filename order by
`npm run db:migrate`. Never edit an applied migration; always add a numbered file.

### Table inventory by class

Verified against `pg_catalog`, not inferred from migration text. **All 71 have
RLS enabled.**

| Class | Tables | Policy | Grant to anon/auth | Reachable from a browser |
|---|---|---|---|---|
| **Public catalogue** | `Product`, `ProductImage`, `Collection`, `Category`, `ScentProfile`, `MerchPage` | SELECT | SELECT only (`Product`: **column-level**, minus `costInCents`) | yes, read-only |
| **Public content** | `Article`, `Testimonial`, `TimelineEvent`, `BrandValue`, `MissionStatement`, `CraftPillar`, `CraftStep`, `CraftStat`, `CraftQuote`, `Ingredient`, `IngredientFamily`, `IngredientUsage`, `Stockist`, `LegalDocument`, `EnquirySubject`, `ContactChannel`, `SocialProfile`, `BoutiqueSetting`, `LandingSection`, `HeroSetting`, `HeroSlide`, `NavLink`, `Announcement`, `MarketingSetting`, `DeliverySetting`, `BenefitSetting` | SELECT | SELECT only | yes, read-only |
| **Public commerce rules** | `offers`, `offer_trigger_*`, `offer_reward_*`, `promotions`, `promotion_*` | SELECT, gated on live/date | SELECT only | yes, read-only |
| **Visitor content** | `product_comment`, `product_comment_image` | SELECT (published) | SELECT only | yes, read-only |
| **Customer-owned** | `User`, `Address` | **none** | **none** | **no** |
| **Orders & payments** | `Order`, `OrderItem`, `OrderStatusEvent`, `StripeWebhookEvent` | **none** | **none** | **no** |
| **Credits & rewards** | `customer_credits`, `credit_transactions`, `points_transactions` | **none** | **none** | **no** |
| **Discounts** | `discounts`, `discount_products`, `discount_collections`, `discount_grants`, `discount_redemptions` | **none** | **none** | **no** |
| **Marketing** | `NewsletterSubscriber`, `campaigns`, `campaign_recipients`, `campaign_sends`, `email_suppressions` | **none** | **none** | **no** |
| **Financial** | `expenses`, `expense_categories`, `expense_recurring_rules`, `financial_targets`, `order_item_sales_ledger` | **none** | **none** | **no** |
| **Inventory & audit** | `InventoryMovement`, `admin_notification_reads`, `customer_notification_reads` | **none** | **none** | **no** |

Private tables carry **no policy and no grant** — two independent refusals.
Confirmed live: nine such tables and views answered `401 permission denied` to
the publishable key.

### Views

| View | `security_invoker` | Granted | Note |
|---|---|---|---|
| `active_product_promotions` | **on** | anon, authenticated | Public promo data — correct |
| `DailySales`, `ProductSales`, `SalesLedgerRow` | on | — | Admin only |
| `credit_balances`, `customer_directory`, `reward_balances` | **on** | — | Fixed by `0064`, **applied 2026-09-07** |

A view without `security_invoker` bypasses RLS. `0064_security_hardening.sql`
was applied on 2026-09-07: **all seven views are now `security_invoker`**, so a
future `grant` on any of them can no longer expose more than the grantee's own
policies allow.

### Key relationships

```
Category ──< Collection ──< Product ──< ProductImage
                              │  └──< IngredientUsage >── Ingredient >── IngredientFamily
                              └──< OrderItem >── Order >── User >── Address
                                        │            └──< OrderStatusEvent
                                        └──< order_item_sales_ledger
User ──< customer_credits ──< credit_transactions
     ──< points_transactions          discounts ──< discount_grants / _redemptions
NewsletterSubscriber ──< campaign_recipients >── campaigns ──< campaign_sends
```

### Critical functions

| Function | Security | Callable by | Purpose |
|---|---|---|---|
| `place_order(jsonb)` | definer | **service_role only** | Order + stock in one transaction, under slug-ordered `for update` locks |
| `settle_order_payment(text,text)` | definer | **service_role only** | The only path to PAID. Returns true once per order |
| `expire_unpaid_orders(int)` | definer | **service_role only** | Cancels + restocks holds older than 30 min |
| `restock_order(text)` | definer | **service_role only** | Idempotent on `stockReleasedAt` |
| `set_order_status(text,…)` | definer | **service_role only** | Status changes; restocks on CANCELLED/REFUNDED |
| `resolve_discount(…)` | definer | **service_role only** | `for update` on the discount row before counting |
| `resolve_points_redemption(…)` | definer | **service_role only** | `pg_advisory_xact_lock` per customer |
| `record_stripe_event(…)` | definer | **service_role only** | Insert-and-report event ledger |
| `sync_clerk_user(jsonb)` | definer | **service_role only** | Upsert on `clerkId` |
| `unsubscribe_newsletter(text)` | definer | **service_role only** | By token, never by id |
| `welcome_offer()` | definer | **anon** | Public welcome offer — returns `kind`+`value` only |
| `related_products(…)` | definer | anon | Fixed by `0065`; cost stripped from output |
| `hybrid_search_products(…)` | definer | anon | Fixed by `0065`; cost stripped from output |
| `related_articles(…)` | invoker | anon | Works |

**89 of 103 functions explicitly revoke `execute` from `public, anon,
authenticated`.** Every `security definer` function pins `search_path`.

### Safe change procedure

`migration → SQL → RLS → test → deploy`, worked example:

```sql
-- supabase/sql/0065_add_gift_message.sql
alter table public."Order"
  add column if not exists "giftMessage" text;

-- "Order" is private: no policy, no grant. Nothing further is needed —
-- the column inherits the table's refusals. If it were a public table you
-- would instead confirm the SELECT policy still says what you mean.
```

```bash
npm run db:migrate    # must print "PostgREST schema cache reload signalled"
npm run db:verify     # staging only — it writes probe rows
```

Then redeploy so the application picks it up.

---

## Phase 23 — Email documentation

Provider **Resend**. Key server-only. Absent key = each send logs a warning and
returns; an order still saves and still appears on the dashboard.

| # | Email | Trigger | Template | Sender | Recipient source | Unsub | Retry |
|---|---|---|---|---|---|---|---|
| 1 | Order confirmation | CASH: at checkout. CARD: `payment_intent.succeeded` | `order-templates.ts:347` | `houseFromAddress()` | `order.customerEmail` (row) | n/a — transactional | Gated by `settle_order_payment()` returning true once |
| 2 | House order slip | with #1 | `order-templates.ts:478` | `orderFromAddress()` | `ORDER_NOTIFICATION_EMAIL` | n/a | same |
| 3 | Refund notice | `charge.refunded` | `order-templates.ts` | `houseFromAddress()` | `order.customerEmail` | n/a | Guarded by status check |
| 4 | Feedback request | `/api/cron/order-feedback` | `order-templates.ts:648` | `houseFromAddress()` | `order.customerEmail` | n/a | `mark_feedback_requested()` claims once |
| 5 | Account welcome | Clerk `user.created` | `welcome-templates.ts:107` | `houseFromAddress()` | new Clerk user | n/a | `claim_welcome()` claims once; failure releases the claim and 500s so Clerk retries |
| 6 | Admin invitation | admin action | `welcome-templates.ts:215` | `houseFromAddress()` | invitee | n/a | manual |
| 7 | Contact enquiry | contact form | `templates.ts:136` | `fromAddress()` | `CONTACT_INBOX_EMAIL` | n/a | rate-limited 3/window |
| 8 | Enquiry acknowledgement | contact form | `templates.ts:183` | `houseFromAddress()` | submitted address | n/a | same |
| 9 | Newsletter welcome | signup | `templates.ts:244` | `houseFromAddress()` | subscriber | **yes** | `subscribe_newsletter()` reports `isNew` |
| 10 | Campaign | cron or admin send | `campaign-template.ts:110` | `houseFromAddress()` | audience rows | **yes** | Chunked under a dispatch lease; `campaign_sends` records each |

### Security properties — all verified

- **Recipients are never caller-chosen.** Every `to:` reads a stored row or an
  environment variable. There is no code path where a request body names a
  recipient.
- **Campaign sending is admin-only** (`requireAdmin()`) plus `CRON_SECRET`.
- **Every interpolated value is escaped** — `escapeHtml()` at
  `campaign-template.ts:69,85,86,87` and `layout.ts:63,77,207`;
  `stripHeaderBreaks()` guards header injection.
- **Unsubscribe tokens are unforgeable** — 64 hex characters from two
  `gen_random_uuid()` values, unique-indexed, matched by token never by id.
- **Unsubscribe is not a GET side effect.** `/unsubscribe` renders a
  confirmation; `confirmUnsubscribe()` writes. Link scanners and prefetchers
  fetch every URL in an email, and would otherwise unsubscribe people silently.
- **Senders are centralised** in `src/lib/email/addresses.ts`. `notifyHouseOfOrder`
  refuses to send from the same mailbox it sends to, because a sender addressing
  itself scores worse with spam filters.

**No email was sent during this audit.**

### Where do I change…

- **A template?** The builder in `src/lib/email/*-templates.ts`. Shared chrome in
  `layout.ts`.
- **Add an email?** Builder → send function resolving sender from
  `addresses.ts` and recipient from stored data → escape everything → honour
  `email_suppressions` if marketing.
- **Sender settings?** `src/lib/email/addresses.ts` + the `RESEND_*` variables.
- **Database-controlled?** Recipients, campaign content, subscriber list,
  suppressions, `CONTACT_INBOX_EMAIL` fallback via `BoutiqueSetting`.
- **Hardcoded?** Template structure, layout, copy, and the default addresses in
  `addresses.ts`.

---

## Phase 24 — Developer README

`README.md` rewritten from the stock `create-next-app` boilerplate (36 lines) to
a **25-section handbook**. It answers every question the brief lists:

| Question | Section |
|---|---|
| Where do I change content / products / prices? | §7, §20 |
| Discounts? Emails? Campaigns? | §11, §12, §13 |
| Navigation? Branding / design tokens? | §8 |
| Authentication? Admin permissions? | §5 |
| Database structure? Add a migration? Update RLS? | §6 |
| Modify Stripe / Cloudinary / Resend? | §9–10, §14, §12 |
| Run tests? Deploy? | §21, §18 |
| What must never be changed casually? | §22 |

Every path is real and was checked. Where something is database-managed,
hardcoded, environment-controlled or generated, the README says which.

---

## Phase 25 — Final adversarial review

Re-run against the fixed tree. Read-only, per the standing constraint.

### As an anonymous attacker

| Attempt | Result | Why |
|---|---|---|
| Read orders / users / credits / discounts / subscribers / campaigns / finance | **BLOCKED** | No policy **and** no grant. Nine live probes → `401` |
| Read the customer directory or credit balances via a view | **BLOCKED** | No grant; `401` |
| Read `Product.costInCents` | **BLOCKED** | Column-level grant excludes it; `401` |
| See archived products | **BLOCKED** | RLS `isArchived = false`. Proven: 1 archived row exists, query returns `[]` |
| Write anything through the Data API | **BLOCKED** | Zero INSERT/UPDATE/DELETE policies **and** privileges revoked |
| Call `place_order` / `settle_order_payment` / `adjust_credit` directly | **BLOCKED** | `execute` revoked from `public, anon, authenticated` |
| Reach an admin page or action | **BLOCKED** | `requireAdmin()` → 404, on the page and on every action |
| Forge a Stripe webhook | **BLOCKED** | `constructEvent` on the raw body; missing secret → 500 |
| Forge a Clerk webhook | **BLOCKED** | Svix verification; missing secret → 500 |
| Trigger a cron | **BLOCKED** | Constant-time bearer compare; missing secret → refuse |
| Manipulate a price | **BLOCKED** | Only `{productId, quantity}` is accepted; every figure derived in SQL |
| Create a paid order | **BLOCKED** | Only the verified webhook may settle, and it re-verifies amount **and** currency |
| Abuse public forms | **LIMITED** | Rate limits + honeypots; per-instance memory is the known weakness |
| Upload a dangerous file | **BLOCKED** | Magic-byte sniffing; extension derived from sniffed type |
| Enumerate order ids | **IMPRACTICAL** | UUIDs, plus four state guards and a 30-minute window |

### As a signed-in customer

| Attempt | Result |
|---|---|
| Read/modify another customer's address | **BLOCKED** — every mutation carries `.eq("userId", userId)`; zero rows returns an opaque failure |
| Read another customer's orders | **BLOCKED** — no grant on `Order` at all |
| Change payment or order state | **BLOCKED** — no client path; webhook only |
| Redeem another account's credit | **BLOCKED** — owner compared to session id inside `place_order()` under `for update` |
| Reuse a one-time discount | **BLOCKED** — `for update` taken before counting redemptions |
| Redeem more points than held | **BLOCKED** — advisory lock per customer |
| Reach admin functions | **BLOCKED** — `requireAdmin()` on every action |
| Trigger a campaign | **BLOCKED** — admin + cron secret |

### Malicious input

| Attempt | Result |
|---|---|
| XSS via journal JSON-LD | **BLOCKED** — F1 fixed; `<` escaped, proven |
| XSS via rich text | **N/A** — structured JSON rendered by a component switch, no `dangerouslySetInnerHTML` |
| XSS via email HTML | **BLOCKED** — `escapeHtml()` on every interpolation |
| SQL injection | **BLOCKED** — parameter binding; the only dynamic SQL runs at migration time on literal names |
| Open redirect | **BLOCKED** — rejects `//`, `\`, whitespace, control characters |
| SSRF | **N/A** — no outbound fetch takes a user URL |
| Negative quantity / credit | **BLOCKED** — Zod `.min(1)`, and CHECK constraints in SQL |
| Oversell the last unit | **BLOCKED** — `check (inventory >= 0)` + row locks |
| Replay a webhook | **BLOCKED** — event ledger + per-order settle guard |
| Privilege escalation via `search_path` | **BLOCKED** — every definer function pins it |

**No new security finding.** The four `UNVERIFIED — requires staging` items
remain the honest boundary of what read-only analysis can prove.

---

## Verification commands — final run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npm run lint` | **exit 0** |
| `npm audit` | **found 0 vulnerabilities** |
| `npm run build` | **exit 0** on four runs, **exit 1** on one — see F17 below |
| Live anon probes | private tables/views `401`; catalogue `200`; archived `[]` |
| JSON-LD on `/` and `/perfume/amber` | Organization, WebSite, Product, Offer, Breadcrumb present |

⚠ **Every build prints ~60 `getRelatedProductCards failed` lines.** That is F15,
and it is why §21 of the README tells you to read the build log rather than
trust its exit code.

### F17 — the production build is not reliably reproducible (**MEDIUM**)

One of five builds in this audit **failed**, on unchanged code that had built
successfully minutes earlier — and the immediate re-run of that same code
returned **exit 0**, which is what establishes it as transient rather than a
regression:

```
[marketing] getLiveAnnouncements timed out after 60000ms          × 6
[catalog]   getRelatedProductCards failed: TypeError: fetch failed × 6
Failed to build /[locale]/set/[slug]/page: /en/set/temple-hearth-set
  after 3 attempts.
⨯ Next.js build worker exited with code: 1
```

**This is not a code defect and not caused by any audit change.** It is the
Supabase REST stall that `src/lib/supabase.ts:56-60` already documents from
measurement — *"the same query over a direct SQL connection returned in
194–249ms eight times out of eight, while the REST path stalled indefinitely on
roughly one request in five."*

What makes it fail the **build** rather than degrade a page is deliberate and,
in ordinary circumstances, correct: `timeoutFetch()` removes its 10-second
deadline when `NEXT_PHASE === "phase-production-build"` (`supabase.ts:104-106`),
on the reasoning that baking an empty grid into static HTML for a whole
revalidate window is worse than a slow build, and that Next already retries a
hung page three times.

The gap is that Next's retry budget is 3 × 60s **per page**, and when several
prerendered pages stall at once the budget is exhausted and the export aborts.
The mitigation assumes stalls are isolated; this build shows they cluster.

**Impact.** A deploy can fail for no reason attributable to the commit, and the
next attempt succeeds. Cheap on Vercel — press redeploy — but it will read as
"the build is flaky" and erode trust in a genuine failure later.

**Recommended fix (not applied — it is a judgement call about build behaviour):**
give the build phase a bound that is generous but finite, rather than none —
e.g. 25 seconds, comfortably above the ~1s worst measured healthy read and
comfortably below Next's 60s page timeout, so a stalled read fails fast, is
retried by Next while the budget still has room, and only a genuinely
unreachable database fails the deploy. The alternative, reading through the
direct SQL connection at build time, is a larger change to how prerender fetches
data.

---

## Complete findings ledger

### Fixed (11)

| Sev | Finding | Fix |
|---|---|---|
| MED–HIGH | F1 JSON-LD `</script>` XSS | `src/lib/json-ld.ts`; proven |
| HIGH | F2 sharp/libvips + nanoid CVEs | `next` 16.3.4, `nanoid` 3.3.18 → 0 vulns |
| MED | F3 No security headers | `headers()` in `next.config.ts`; 5 headers live |
| MED | F4 RLS-bypassing views | `0064` (written, not applied) |
| MED | F5 No limit on intent route | 20/10 min |
| LOW–MED | F6 `/design-preview` public | Deleted, 2,933 lines |
| LOW | F7 `NEXT_PUBLIC_KHEM_PRELAUNCH` doc | Rewritten |
| LOW | F8 "Applied last" untrue | Corrected |
| LOW | F9 Stale service-role caller list | Corrected to 7 |
| LOW | F10 Unrevoked trigger definers | `0064` |
| LOW | F11 Unpinned `search_path` | `0064` |
| LOW | F14 Missing `noindex` | On the account layout |
| LOW | F16 No structured data | Organization, WebSite, Product, Offer, Breadcrumb |

### Open

| Sev | Finding | Action |
|---|---|---|
| **HIGH** | **F15** search + related products 401 | **Fix written & verified — `0065`. Apply it.** |
| MEDIUM | **F17** build not reliably reproducible (1 in 5 failed) | Bound the build-phase read; see above |
| MEDIUM | F13 soft 404 status | Indexing mitigated; status fix is a design call |
| LOW | Unsplash placeholder imagery | Content task |
| INFO | F12 AGENTS.md §9/§10 wrong | Documented in README §4 |

### Accepted risks

1. `/api/checkout/intent` does not verify order ownership — reasoned, bounded by
   a UUID and four state guards.
2. Rate limiting is per-instance memory.
3. Guest orders carry no session; the order UUID is the only credential.

---

## Definition of Done

| Item | Status |
|---|---|
| Security audit completed | ✅ |
| Critical/high findings fixed or documented | ✅ (F15 documented, open) |
| Authentication / authorization / RLS verified | ✅ |
| Service-role usage verified | ✅ 7 sites |
| Secrets verified · client bundle · git history | ✅ |
| Stripe / webhook / payment state verified | ✅ static; live rail needs test keys |
| Inventory concurrency verified | ✅ by constraint + lock; race unproven |
| Discounts / credits verified | ✅ |
| Email · upload · public endpoints · headers · CSRF · dependencies · errors | ✅ |
| SEO / public surface reviewed | ✅ |
| Lint · typecheck · build pass | ✅ |
| **Tests pass** | ❌ **No test framework exists** |
| Functional regression | ⚠️ partial — F15 is a live failure |
| Mobile regression | ⚠️ code-level only; needs a device |
| Architecture · database · email · CMS · env · deployment documented | ✅ |
| Root README completed | ✅ 25 sections |
| Final adversarial review | ✅ |

### SEO Definition of Done

Sitemap audited ✅ · dynamic ✅ · no private URLs ✅ · robots audited ✅ ·
assets crawlable ✅ · private routes protected ✅ · canonical ✅ · metadata ✅ ·
product SEO ✅ · collection SEO ✅ · structured data ✅ · **internal linking ⚠️
blocked by F15** · orphans ⚠️ same · redirects ✅ · AI readiness ✅ · image SEO ✅ ·
headings ✅ · CWV reviewed ✅ · production sitemap/robots tested ✅ ·
README SEO section ✅.

---

## What to do next, in order

1. **Apply `0065`** — `npm run db:migrate`. The fix for F15 is written and
   dry-run verified; applying it is the one remaining launch blocker. Confirm
   the run prints "PostgREST schema cache reload signalled", then check that a
   product page shows its related rail and that `/api/search` stops falling
   back.
2. **Bound the build-phase read (F17)**, or accept that roughly one deploy in
   five needs a retry.
3. **`0064`** applies in the same run — it is in the same directory.
4. **Deploy a preview.** Watch the console for CSP violations across home, PDP,
   cart, card checkout, sign-in and `/admin`.
5. **Promote the CSP** to enforcing once the report is clean.
6. **Real-device mobile pass** on that preview.
7. **Provision staging** and settle the four `UNVERIFIED` items.
8. **Replace the Unsplash placeholders.**
9. Consider a test framework — its absence is why F15 lived this long.
