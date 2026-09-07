# KHEM — Final Pre-Launch Security, QA & Developer Handoff Audit

> Run from the KHEM repository root with Claude Code.
>
> This is a deep implementation audit, not a documentation-only exercise.
> Inspect the actual code, SQL, configuration, build output, dependencies,
> and runtime behavior.

---

# Mission

Deliver two things:

1. A secure, tested, production-ready KHEM application.
2. A complete `README.md` that allows a future developer to understand and safely maintain the application without reverse-engineering the repository.

## Rules

- Work phase by phase.
- Do not skip phases.
- For every item report **PASS / FAIL / N/A**.
- Include concrete `file:line` evidence wherever applicable.
- Fix safe FAILs immediately, then re-test them.
- Do not weaken security to obtain PASS.
- Do not make destructive production changes.
- Never print real secrets in the report.
- Use safe test accounts and non-production data.
- Preserve existing KHEM business behavior/design unless a security or correctness fix requires a change.
- Do not invent architecture, paths, commands, environment variables, or deployment details.
- Derive everything from the actual repository.
- At the end, repeat the complete verification suite after all fixes.

---

# Phase 0 — Repository & Architecture Discovery

Before changing anything, inspect the entire repository.

Create a concise architecture map identifying:

- Next.js version
- App Router structure
- Server Components
- Client Components
- Server Actions
- API / Route Handlers
- middleware
- Clerk authentication
- Supabase clients
- database migrations
- RLS policies
- database functions
- database triggers
- Stripe checkout
- Stripe webhook
- Cloudinary
- Resend
- Tiptap
- admin architecture
- product/catalog architecture
- CMS / World of KHEM
- cart
- checkout
- orders
- customers
- discounts
- promotions
- customer credits
- campaigns
- subscribers
- scheduled jobs / cron
- logging
- error handling
- environment configuration
- deployment configuration

Document the real flow:

Browser
→ Next.js
→ Authentication
→ Server logic
→ Supabase / Stripe / Cloudinary / Resend

Do not assume this architecture. Verify it from the code.

---

# Phase 1 — Secrets & Environment Leaks

## 1.1 Environment audit

Search the entire repository including:

- `.env*`
- source
- scripts
- config
- SQL
- tests
- fixtures
- documentation
- generated files
- `.next`
- public assets

Search for:

- Supabase service-role key
- Supabase anon/public key
- Stripe secret key
- Stripe webhook secret
- Resend API key
- Cloudinary API secret
- Clerk secret key
- database credentials
- SMTP credentials
- OAuth secrets
- webhook secrets
- private keys
- generic token/password patterns

Confirm server secrets never use:

`NEXT_PUBLIC_`

## 1.2 Client bundle

Run a production build.

Inspect generated client JavaScript and browser-reachable assets.

Confirm none of the following appear:

- Supabase service-role key
- Stripe secret key
- Stripe webhook secret
- Resend API key
- Cloudinary API secret
- Clerk secret key
- database credentials

Public configuration may be exposed only when intentionally required.

## 1.3 Git history

Inspect:

- `.gitignore`
- `git status`
- `git log`
- historical diffs
- tracked `.env` files

Search Git history for real credentials.

If a credential was ever committed:

- do not print it
- identify its category
- report that rotation is required

## 1.4 Source maps / debug leaks

Check production output for:

- source-map exposure
- stack traces
- SQL
- internal paths
- environment values
- debug endpoints
- internal configuration

---

# Phase 2 — Clerk Authentication & Authorization

## 2.1 Middleware

Inspect `middleware.ts`.

Map:

- public routes
- authenticated routes
- admin routes
- sensitive API routes

Verify API routes are protected independently from page routes.

## 2.2 Server-side identity

For every Server Action and API route touching:

- customers
- profiles
- addresses
- orders
- order items
- wishlist
- cart
- credits
- discounts
- campaigns
- email
- admin data

confirm identity is determined server-side.

Never trust client-supplied:

- user ID
- customer ID
- role
- ownership
- authorization flag

## 2.3 Admin authorization

Every admin operation must have server-side authorization.

Test:

1. Anonymous user
2. Normal customer
3. Admin

Attempt direct access to:

- admin pages
- APIs
- Server Actions
- mutations

A hidden UI button is NOT authorization.

## 2.4 Clerk webhook

If present:

- verify Svix signature
- reject invalid signatures
- validate event types
- handle duplicate events
- avoid trusting arbitrary payloads

## 2.5 Auth edge cases

Test:

- expired sessions
- stale sessions
- deleted users
- mismatched user IDs
- direct API access
- unauthorized mutations

---

# Phase 3 — Supabase Database & RLS

This is a critical phase.

Read every database migration.

## 3.1 Table inventory

Identify every table.

Classify:

- public catalog/content
- customer-owned
- orders/payments
- admin/internal
- marketing
- financial
- system/audit
- jobs/queues

## 3.2 RLS

For every sensitive table confirm:

`ENABLE ROW LEVEL SECURITY`

Pay special attention to:

- customers
- profiles
- addresses
- carts
- cart items
- orders
- order items
- wishlist
- customer credits
- credit transactions
- discount grants
- subscribers
- campaigns
- campaign recipients
- payments
- internal/admin tables

RLS disabled is FAIL unless there is a verified reason the table is completely server-only.

## 3.3 Policy audit

For every policy inspect:

- `USING`
- `WITH CHECK`
- role
- operation
- ownership
- admin conditions

Flag:

- `USING (true)`
- unrestricted `WITH CHECK`
- client-trusted user IDs
- cross-user access
- unrestricted update/delete

Check INSERT, SELECT, UPDATE and DELETE separately.

## 3.4 Service-role audit

Find every service-role client.

For each occurrence determine:

- why it exists
- server-only status
- whether a browser can trigger the code
- authorization before use
- whether user-controlled input can abuse it

A service-role client inside a user-facing endpoint requires especially careful review.

## 3.5 SQL functions / RPC

Inspect every function.

Check:

- `SECURITY DEFINER`
- `search_path`
- authorization
- privilege escalation
- input validation
- dynamic SQL
- SQL injection
- execute permissions

Revoke dangerous functions from public roles where appropriate.

## 3.6 Direct RLS attacks

With safe test accounts:

User A attempts to:

- read User B's data
- update User B's data
- delete User B's data
- modify User B's order
- modify User B's address
- modify User B's credits
- modify User B's discounts

Security must hold at the database/security layer, not only in application UI.

---

# Phase 4 — IDOR / Broken Access Control

Perform a dedicated identifier sweep.

Inspect IDs from:

- URL parameters
- query parameters
- request bodies
- forms
- Server Actions
- API routes
- cookies
- local storage
- client state

Test:

- orders
- order items
- addresses
- profiles
- wishlist
- carts
- credits
- discounts
- subscriptions
- campaigns
- media
- admin resources

Attempt:

- replacing UUIDs
- replacing sequential IDs
- copying another user's URL
- handcrafted requests
- stale authorization
- privilege escalation

Every protected resource must authorize ownership independently.

---

# Phase 5 — Input Validation & Injection

Audit every external input.

Sources:

- URL params
- search params
- request bodies
- forms
- Server Actions
- cookies
- headers
- uploads
- webhooks
- rich text
- admin CMS

Check for:

- SQL injection
- XSS
- stored XSS
- reflected XSS
- DOM XSS
- HTML injection
- command injection
- path traversal
- SSRF
- open redirects
- prototype pollution
- unsafe deserialization
- mass assignment
- unsafe object merging

## Tiptap

Inspect:

- storage
- sanitization
- transformations
- rendering

Confirm rich text cannot execute JavaScript.

Admin-authored content must also be considered untrusted when rendered publicly.

---

# Phase 6 — Stripe & Payment Security

## 6.1 Checkout

Confirm the SERVER determines:

- product
- current price
- quantity
- stock
- discount validity
- customer identity
- final amount

Never trust client:

- price
- total
- discount
- payment status
- order status

## 6.2 Stripe webhook

Confirm:

- raw body is used
- signature is verified
- invalid signatures are rejected
- event types are validated
- processing is idempotent
- duplicate events cannot fulfill twice

## 6.3 Success redirect

A browser success URL/query parameter must NEVER independently mark an order as paid.

## 6.4 Payment state machine

Document:

`Cart → Checkout → Stripe → Webhook → Payment → Order → Fulfillment`

Audit every transition.

## 6.5 Replay

Verify repeated Stripe events cannot:

- duplicate orders
- duplicate fulfillment
- duplicate credits
- duplicate harmful emails
- duplicate inventory decrement

---

# Phase 7 — Inventory & Concurrency

Identify exact stock decrement logic.

Test or safely simulate:

- two purchases of final unit
- multiple tabs
- duplicate checkout
- request retries
- webhook retries
- payment failure
- delayed payment
- abandoned checkout

Confirm:

- stock never becomes negative
- final unit cannot be oversold
- duplicate processing cannot decrement twice

Prefer atomic database operations, constraints or transactions.

---

# Phase 8 — Discounts, Promotions & Credits

Audit:

- subscriber discount
- first-subscription discount
- promotions
- campaign discounts
- customer credits
- discovery purchase credit
- full perfume redemption
- discount grants
- expiry
- one-time use
- stacking rules

Attack:

- reuse
- duplicate redemption
- negative quantities
- negative credits
- changed customer IDs
- changed discount IDs
- expired discounts
- excluded products
- concurrent redemption

All monetary calculations must happen server-side.

---

# Phase 9 — Resend / Email Security

Inventory every email.

For each email document:

- name
- purpose
- trigger
- template file
- variables
- sender
- recipient source
- Resend call
- unsubscribe behavior
- retry/failure behavior

Confirm:

- API key is server-only
- users cannot choose arbitrary recipients
- campaign sending is admin-only
- HTML is safe
- user-controlled values are escaped/sanitized
- unsubscribe tokens cannot be forged
- unsubscribe affects future marketing sends
- duplicate sends are controlled

Do not send real bulk campaigns during testing.

---

# Phase 10 — Cloudinary / Upload Security

Inspect every upload path.

Confirm:

- file type validation
- MIME validation
- extension validation
- size limits
- image dimension limits where appropriate
- filename handling
- signed upload security
- transformations
- public/private policy

Test safely:

- oversized files
- invalid MIME
- executable extensions
- renamed files
- malformed images
- unexpected content types

Secrets must remain server-side.

---

# Phase 11 — Public Forms & Abuse Protection

Inventory:

- newsletter
- contact
- subscribe
- authentication forms
- checkout
- uploads
- expensive public actions

Check:

- rate limiting
- validation
- spam protection
- request size limits
- duplicate submission protection
- abuse prevention
- safe errors

---

# Phase 12 — Security Headers & Browser Security

Inspect production headers.

Check:

- CSP
- `X-Content-Type-Options: nosniff`
- Referrer-Policy
- HSTS
- Permissions-Policy
- frame protection
- secure cookies
- SameSite
- CORS
- sensitive response caching

Do not add headers blindly if they break:

- Clerk
- Stripe
- Cloudinary
- Tiptap
- required KHEM functionality

Review CSP sources carefully.

---

# Phase 13 — CSRF

Inspect cookie/session-authenticated mutations:

- Server Actions
- APIs
- admin mutations
- profile changes
- address changes
- checkout
- account changes

Determine whether framework protections are sufficient.

---

# Phase 14 — Error Handling & Information Disclosure

Trigger controlled errors.

Check production responses for:

- stack traces
- SQL
- database schema
- filesystem paths
- environment variables
- internal IDs
- framework internals

Check logs for:

- passwords
- tokens
- authorization headers
- payment secrets
- unnecessary personal data

---

# Phase 15 — Dependencies & Supply Chain

Run:

```bash
npm audit
npm outdated
````

Inspect:

* package-lock
* dependency versions
* duplicate security-sensitive dependencies
* suspicious packages
* abandoned packages

Pay particular attention to:

* Next.js
* React
* Clerk
* Supabase
* Stripe
* Resend
* Cloudinary
* Tiptap

Classify updates:

* Security critical
* Recommended
* Safe to defer
* Breaking upgrade

Do not blindly upgrade.

---

# Phase 16 — Build / Type / Lint / Tests

Discover the actual repository commands.

Run:

* lint
* TypeScript
* unit tests
* integration tests
* production build

Also inspect build output.

Do not claim success unless actually executed.

---

# Phase 17 — Functional Regression

Test:

1. Landing page
2. Navigation
3. Collections
4. Product pages
5. Product selection
6. Cart
7. Discount
8. Checkout
9. Stripe test payment
10. Order creation
11. Order confirmation
12. Account/profile
13. Customer orders
14. Admin access
15. Admin dashboard
16. Product/content editing
17. Campaign/email management
18. Media upload
19. Mobile navigation
20. Mobile checkout

Test both success and failure paths.

---

# Phase 18 — Mobile QA

Test on a real mobile browser where possible.

Check:

* navigation
* product cards
* product detail
* cart
* checkout
* forms
* popups
* announcement bar
* loading states
* error states

---

# Phase 19 — SEO & Public Surface

Check:

* robots
* sitemap
* metadata
* canonical URLs
* OpenGraph
* public content
* admin noindex
* private route exposure
* unpublished CMS content
* internal endpoint exposure

Confirm private data cannot be indexed.

---

# Phase 20 — Architecture & Code Quality

Look for:

* duplicated business logic
* client-side business rules
* unsafe utilities
* dead security code
* unused secrets/config
* inconsistent authorization
* duplicated Supabase clients
* incorrect server/client boundaries
* unnecessary service-role usage
* hardcoded IDs
* hardcoded prices
* hardcoded admin emails
* fragile environment assumptions
* race-prone logic
* swallowed errors
* dangerous `any` at security boundaries
* TODO/FIXME security issues

Prioritize security and maintainability over cosmetic refactoring.

---

# Phase 21 — Hardcoded / CMS / Environment Audit

Create an inventory.

## Database/CMS controlled

Identify actual locations for:

* landing content
* World of KHEM
* products
* collections
* campaigns
* promotions
* announcements
* editable sections

## Code controlled

Identify:

* layout
* components
* navigation
* validation
* business rules
* checkout
* authentication
* permissions
* integrations

## Environment controlled

Identify:

* secrets
* API keys
* URLs
* deployment configuration
* public configuration

## SQL controlled

Identify:

* schema
* RLS
* policies
* functions
* triggers
* indexes
* constraints
* migrations

For every important item answer:

> If a future developer wants to change this, exactly where do they go?

---

# Phase 22 — Database Documentation

Create a complete database reference.

For every table document:

* name
* purpose
* important columns
* primary key
* foreign keys
* relationships
* indexes
* constraints
* RLS status
* policies
* SELECT permissions
* INSERT permissions
* UPDATE permissions
* DELETE permissions
* service-role dependencies
* triggers/functions
* migration file

Document safe changes to:

* products
* collections
* content
* customers
* orders
* order items
* discounts
* promotions
* credits
* campaigns
* subscribers

Explain:

`migration → SQL → RLS → test → deploy`

---

# Phase 23 — Email Documentation

Create an email map.

For every email document:

* name
* purpose
* trigger
* template location
* variables
* sender
* recipient logic
* Resend call
* unsubscribe behavior
* retry behavior

README must answer:

> Where do I change an email template?

> How do I add a new email?

> Where are sender settings?

> What is database-controlled?

> What is hardcoded?

---

# Phase 24 — Complete Developer README

Create/update:

`README.md`

This must be a practical developer handbook.

## Required sections

### 1. Project Overview

Explain KHEM and the application.

### 2. Technology Stack

Use actual installed versions.

### 3. Repository Structure

Explain important directories/files.

### 4. Architecture

Explain actual request/data flow.

### 5. Authentication

Document:

* Clerk
* middleware
* identity
* admin authorization
* webhook

### 6. Database

Document:

* Supabase
* migrations
* RLS
* policies
* service role
* database functions

### 7. Products & Content

Give exact paths/tables for changing:

* products
* collections
* landing page
* World of KHEM
* announcements

### 8. Navigation & UI

Document:

* navigation
* branding
* design tokens
* shared components
* global layout

### 9. Cart & Checkout

Explain the complete flow.

### 10. Orders

Explain:

* creation
* payment
* webhook
* state changes
* customer view
* admin view

### 11. Discounts / Promotions / Credits

Document all business rules and implementation locations.

### 12. Emails

Document every email and template.

### 13. Campaigns

Document:

* subscribers
* customers
* send-specific
* campaign lifecycle
* unsubscribe
* Resend

### 14. Media

Document Cloudinary and uploads.

### 15. Admin

Document:

* admin entry point
* permissions
* server-side protection

### 16. Environment Variables

Create:

| Variable | Required | Public/Server | Purpose |
| -------- | -------- | ------------- | ------- |

Never put real values in README.

### 17. Local Development

Document actual:

* installation
* environment setup
* migrations
* dev server
* test commands
* build commands

### 18. Production Deployment

Document actual:

* hosting
* domain
* environment
* Clerk
* Supabase
* Stripe
* Resend
* Cloudinary
* webhooks

Do not invent commands.

### 19. Database Change Guide

Provide a real safe example:

`migration → SQL → RLS/policy → test → deploy`

# Phase 19.5 — Advanced SEO, Sitemap, Robots & AI Search Readiness

This phase is mandatory.

Audit and improve KHEM's entire organic-search architecture for modern Google Search, AI-assisted search/discovery, rich results, semantic understanding, and long-term SEO.

Do not use outdated or spammy SEO tactics.

The goal is to make KHEM extremely easy for search engines and AI systems to understand, crawl, index, and correctly associate with its products, brand, collections, ingredients, heritage, and content.

---

## 19.5.1 — Sitemap Audit

Inspect the current sitemap implementation.

Determine whether it is:

- static
- dynamically generated
- database/CMS driven
- generated by Next.js metadata APIs
- manually maintained

Then improve it using the actual application architecture.

The sitemap must include all legitimate public, indexable URLs such as:

- homepage
- collection pages
- product pages
- public World of KHEM pages
- ingredient pages if publicly indexable
- educational/editorial pages if publicly indexable
- other important commercial landing pages

Do NOT include:

- admin pages
- dashboard pages
- login/authentication pages
- checkout
- cart
- account pages
- private customer pages
- API routes
- internal tools
- preview/draft URLs
- unpublished content
- duplicate URLs
- URLs blocked from indexing

Verify:

- canonical URLs
- absolute URLs
- correct production domain
- no localhost URLs
- no development URLs
- no duplicate URLs
- no broken URLs
- no stale/deleted URLs
- no unnecessary query parameters
- correct handling of dynamic `[slug]` routes
- correct handling of unpublished content

If content is database-driven, the sitemap must reflect published database content automatically rather than requiring developers to manually add every URL.

If the site has enough URLs to require sitemap indexes/chunks, implement the correct structure.

---

## 19.5.2 — Sitemap Freshness

Verify that sitemap generation reflects content changes.

When a developer:

- adds a product
- removes a product
- publishes content
- unpublishes content
- changes a slug
- adds a collection
- removes a collection

the sitemap must eventually reflect the new state.

Do not allow stale URLs to remain indefinitely.

Inspect caching/revalidation behavior.

---

## 19.5.3 — Robots.txt

Audit the current `robots.txt`.

It must:

- allow legitimate public crawling
- block private/internal areas
- reference the canonical production sitemap
- avoid accidentally blocking important public pages/assets
- avoid unnecessary crawler restrictions
- avoid outdated directives
- avoid blocking CSS/JS/image resources needed for rendering/search understanding

Explicitly verify that important:

- product pages
- collection pages
- content pages
- images
- structured data
- public assets

remain crawlable.

Do not blindly add `Disallow` rules.

Remember:

`robots.txt` controls crawling; it is not a security mechanism.

Private data must be protected by authentication/authorization regardless of robots rules.

---

## 19.5.4 — Metadata Audit

Audit every important public page.

Check:

- `<title>`
- meta description
- canonical
- robots metadata
- OpenGraph
- Twitter/X metadata where appropriate
- language
- viewport
- favicon
- relevant alternate metadata

Titles and descriptions must be:

- unique
- accurate
- descriptive
- human-readable
- aligned with actual page content
- useful for search intent

Avoid:

- keyword stuffing
- duplicate titles
- generic titles
- misleading descriptions

---

## 19.5.5 — Canonical URL Strategy

Create a clear canonical URL strategy.

Verify canonical URLs for:

- products
- collections
- editorial/content pages
- World of KHEM pages
- pagination where relevant
- filtered/search pages
- query parameters

Prevent duplicate indexing caused by:

- query strings
- tracking parameters
- alternate paths
- duplicate slugs
- trailing slash inconsistencies
- uppercase/lowercase inconsistencies
- development URLs

Canonical URLs must always resolve to the real production URL.

---

## 19.5.6 — Structured Data / Schema.org

Audit and improve structured data.

Use only schema types that genuinely match the content.

Consider, where applicable:

- Organization
- WebSite
- WebPage
- BreadcrumbList
- Product
- Offer
- Brand
- Article
- FAQPage only when the page genuinely contains qualifying FAQ content

For product pages verify structured data contains accurate:

- product name
- description
- brand
- image
- SKU/identifier where available
- offers
- price
- currency
- availability
- canonical URL

Never expose fake reviews, fake ratings, fake prices, or information that differs from the visible page.

Structured data must represent visible, legitimate content.

Validate generated JSON-LD for:

- valid JSON
- correct schema structure
- no duplicate/conflicting entities
- no sensitive information
- no stale prices
- no invalid URLs

Use stable identifiers where appropriate so search systems can understand that the same KHEM entity is referenced across pages.

---

## 19.5.7 — Entity / Brand Understanding

Strengthen KHEM's semantic identity.

The website should make it clear that KHEM is a distinct perfume/fragrance brand and that its content, products, collections, ingredients, heritage, and editorial pages belong to the same entity.

Audit consistency of:

- KHEM brand name
- logo
- brand description
- Organization structured data
- social profiles where actually available
- canonical domain
- contact/business information
- product brand relationships

Do not invent social profiles or business information.

Use actual repository/configuration data.

---

## 19.5.8 — Internal Linking

Perform a complete internal-linking audit.

Create meaningful relationships between:

- homepage
- collections
- products
- ingredients
- World of KHEM
- educational/editorial content
- related products
- related collections

Important pages must not become isolated orphan pages.

Use descriptive anchor text.

Avoid:

- generic "click here"
- excessive repeated anchors
- artificial keyword stuffing
- unnecessary links

Build a logical topical structure so search engines can understand relationships between KHEM's:

Brand
→ Collections
→ Products
→ Ingredients
→ Heritage
→ Editorial content

---

## 19.5.9 — Product SEO

Audit every product page.

Verify each has:

- unique title
- unique description
- useful product information
- strong heading hierarchy
- canonical URL
- product structured data
- correct image metadata
- meaningful alt text
- internal links
- availability information where appropriate
- correct price/currency
- crawlable content

Do not generate thin or duplicated product descriptions.

---

## 19.5.10 — Image SEO

Audit public images.

Check:

- meaningful filenames where practical
- accurate alt text
- width/height
- responsive image handling
- appropriate formats
- lazy loading where appropriate
- priority loading for important above-the-fold imagery
- no accidental blocking of important images
- OpenGraph images
- product images

Do not put keyword-stuffed alt text on decorative images.

Decorative images should use appropriate empty alt behavior.

---

## 19.5.11 — Heading & Semantic HTML

Audit page structure.

Confirm:

- one meaningful primary heading where appropriate
- logical H1 → H2 → H3 hierarchy
- semantic HTML
- accessible navigation
- meaningful links
- content available in crawlable HTML
- important information not dependent entirely on client-side interaction

Do not create headings solely for SEO.

---

## 19.5.12 — AI Search / Answer Engine Readiness

Audit the website for modern AI-assisted search systems.

The goal is NOT to manipulate AI rankings.

The goal is to make the site highly understandable and trustworthy as a source.

Improve:

- clear factual product information
- clear brand identity
- descriptive page titles
- meaningful headings
- concise answers to important customer questions
- authoritative editorial content
- ingredient explanations
- collection explanations
- product relationships
- consistent terminology
- structured data
- strong internal linking
- clear entity relationships

Where appropriate, create useful content that naturally answers questions such as:

- What is KHEM?
- What does KHEM represent?
- What is Essence of Heritage?
- What are the KHEM collections?
- What makes each fragrance different?
- What ingredients are used?
- Which fragrance belongs to which collection?
- What fragrance profile does a product have?
- What sizes are available?
- How should a fragrance be used?
- What is the story behind a collection?

Do NOT create fake AI-targeted pages.

Do NOT keyword-stuff.

Do NOT generate thousands of low-quality pages.

Do NOT create content solely for search-engine manipulation.

Every indexed page should provide genuine value.

---

## 19.5.13 — Search Intent Mapping

Map KHEM's important pages to real search intent.

Examples:

- brand searches
- collection searches
- product searches
- fragrance discovery
- ingredient education
- Egyptian-inspired fragrance
- luxury perfume
- heritage/story content

For each major page identify:

- primary intent
- page purpose
- title
- heading
- canonical
- internal links
- structured data

Do not force unrelated keywords onto pages.

---

## 19.5.14 — Crawlability

Audit the entire public crawl path.

Verify search engines can discover important pages through:

- sitemap
- navigation
- internal links
- collection pages
- content pages

Look for:

- orphan pages
- broken links
- redirect chains
- redirect loops
- 404s
- soft 404s
- accidental noindex
- accidental canonical to another page
- blocked resources
- client-only content

---

## 19.5.15 — Indexability

For every major route determine:

`Crawlable? → Indexable? → Canonical? → Included in Sitemap?`

Create a table:

| Route | Public | Crawlable | Indexable | Canonical | Sitemap | Reason |
|---|---|---|---|---|---|---|

Pay special attention to:

- product routes
- collection routes
- World of KHEM
- dynamic slugs
- unpublished content
- admin routes
- customer routes
- search/filter routes

---

## 19.5.16 — Performance / Core Web Vitals

SEO is also affected by real-world page experience.

Inspect:

- LCP
- CLS
- INP
- image loading
- font loading
- JavaScript
- hydration
- unnecessary client components
- render-blocking resources
- third-party scripts

Do not sacrifice KHEM's visual quality.

Prefer targeted performance improvements.

---

## 19.5.17 — Google Search Console Readiness

Verify the repository supports correct production SEO configuration.

Check:

- production canonical domain
- sitemap URL
- robots URL
- HTTPS
- redirects
- metadata
- structured data
- no accidental staging URLs

Document in README:

- where sitemap is generated
- sitemap URL
- robots implementation
- canonical configuration
- where metadata is defined
- where structured data is generated

Do not claim Search Console verification unless it was actually performed.

---

## 19.5.18 — SEO Regression Protection

After improving SEO:

Run the production build.

Verify:

- sitemap generates successfully
- robots generates successfully
- metadata renders
- canonical URLs are correct
- structured data renders
- dynamic product pages build correctly
- unpublished content is excluded
- admin/private pages remain protected

If tests are practical, add automated checks for:

- sitemap accessibility
- robots accessibility
- canonical presence
- duplicate metadata
- invalid structured data
- accidental `noindex`
- localhost URLs in production output

---

## 19.5.19 — Final SEO Deliverable

Add an SEO section to `README.md` documenting:

### Sitemap

- implementation file
- generation method
- production URL
- what is included
- what is excluded

### Robots

- implementation file
- production URL
- important disallow rules
- sitemap reference

### Metadata

- global metadata location
- page-specific metadata location

### Canonical

- implementation
- URL strategy

### Structured Data

- implementation
- schema types
- product schema
- organization schema
- breadcrumb schema

### Content SEO

- product SEO
- collection SEO
- World of KHEM SEO
- internal linking

### SEO Change Checklist

Before changing a public route:

- title checked
- description checked
- canonical checked
- sitemap behavior checked
- robots behavior checked
- structured data checked
- internal links checked
- mobile checked
- production URL checked

---

# SEO Definition of Done

SEO work is complete only when:

- [ ] sitemap audited
- [ ] sitemap dynamically reflects published content
- [ ] no private URLs in sitemap
- [ ] no stale/deleted URLs
- [ ] robots audited
- [ ] important public assets remain crawlable
- [ ] private routes remain protected
- [ ] canonical strategy verified
- [ ] metadata verified
- [ ] product SEO verified
- [ ] collection SEO verified
- [ ] structured data verified
- [ ] internal linking verified
- [ ] orphan pages reviewed
- [ ] broken links reviewed
- [ ] redirect behavior reviewed
- [ ] AI/semantic search readiness reviewed
- [ ] image SEO reviewed
- [ ] heading hierarchy reviewed
- [ ] Core Web Vitals considerations reviewed
- [ ] production sitemap tested
- [ ] production robots tested
- [ ] README SEO documentation completed

### 20. Content Change Guide

Explain exact locations.

### 21. Email Change Guide

Explain exact template locations and variables.

### 22. Security Rules

Document:

* never expose service-role key
* never trust client price
* never trust client user ID
* never bypass RLS casually
* never make admin checks client-only
* never mark payment successful from redirect
* always verify webhooks
* validate uploads
* keep secrets server-side

### 23. Testing

Document actual commands and important manual tests.

### 24. Troubleshooting

Document common problems and investigation paths.

### 25. Future Developer Checklist

Before merging:

* authentication checked
* authorization checked
* RLS checked
* input validated
* secrets checked
* payments checked
* migrations checked
* tests pass
* build passes
* mobile considered

---

# Phase 25 — Final Adversarial Security Review

Act as an attacker.

## Anonymous attacker

Try to:

* access admin APIs
* read customer data
* mutate customer data
* trigger email abuse
* manipulate prices
* create fake orders
* abuse public forms
* upload dangerous files

## Normal customer

Try to:

* access another customer's order
* modify another customer's address
* change payment/order state
* manipulate discounts
* create credits
* access admin functions
* trigger campaigns
* use another customer's identifiers

## Malicious input

Try to:

* execute XSS through rich text
* bypass ID authorization
* exploit SQL/RPC inputs
* abuse service-role endpoints
* replay webhooks
* race inventory
* duplicate discounts
* duplicate credits

---

# Required Audit Output

For every phase use:

| Item | Status        | File / Line | Finding / Evidence | Fix Applied |
| ---- | ------------- | ----------- | ------------------ | ----------- |
| 1.1  | PASS/FAIL/N/A | `path:line` | Concrete evidence  | Exact fix   |

Rules:

* Do not say "looks secure."
* PASS requires evidence.
* FAIL requires a clear finding.
* N/A requires explanation.
* Do not hide warnings.

---

# Final Report

## Security Status

Use:

* CRITICAL
* HIGH
* MEDIUM
* LOW
* CLEAN / READY

Do not invent a percentage.

## Open Findings

| Severity | Finding | Location | Recommended Action |
| -------- | ------- | -------- | ------------------ |

## Fixed Findings

| Severity | Finding | Location | Fix |
| -------- | ------- | -------- | --- |

## Accepted Risks

Only genuinely understood and intentionally unresolved risks.

## Verification Commands

List every command actually executed and its result.

## Files Changed

List every modified file and why.

## Final Architecture

Give a plain-English explanation for the next developer.

## Final Developer Guide

Confirm README answers:

* Where do I change content?
* Where do I change products?
* Where do I change prices?
* Where do I change discounts?
* Where do I change emails?
* Where do I change campaigns?
* Where do I change navigation?
* Where do I change branding/design tokens?
* Where do I change authentication?
* Where do I change admin permissions?
* Where do I change database structure?
* How do I add a migration?
* How do I update RLS?
* How do I modify Stripe?
* How do I modify Cloudinary?
* How do I modify Resend?
* How do I run tests?
* How do I deploy?
* What must never be changed casually?

Use exact repository paths.

If something is database-managed, say so.

If something is hardcoded, say so.

If something is environment-controlled, say so.

If something is generated, explain its source.

If something is unclear, investigate it before documenting it.

---

# Definition of Done

The audit is complete only when:

* [ ] security audit completed
* [ ] critical/high findings fixed or documented
* [ ] authentication verified
* [ ] authorization verified server-side
* [ ] RLS verified
* [ ] service-role usage verified
* [ ] secrets verified
* [ ] client bundle inspected
* [ ] Git history checked
* [ ] Stripe verified
* [ ] webhook verified
* [ ] payment state verified
* [ ] inventory concurrency verified
* [ ] discounts/credits verified
* [ ] email security verified
* [ ] upload security verified
* [ ] public endpoints reviewed
* [ ] security headers reviewed
* [ ] CSRF reviewed
* [ ] dependencies reviewed
* [ ] error disclosure reviewed
* [ ] SEO/public surface reviewed
* [ ] lint passes
* [ ] typecheck passes
* [ ] tests pass
* [ ] production build passes
* [ ] functional regression passes
* [ ] mobile regression performed
* [ ] architecture documented
* [ ] database documented
* [ ] email system documented
* [ ] CMS/content locations documented
* [ ] environment variables documented
* [ ] deployment documented
* [ ] root README completed
* [ ] final adversarial review completed

## Final rule

Do not mark the project **CLEAN / READY** merely because the audit was performed.

The implementation itself must pass the relevant checks.
