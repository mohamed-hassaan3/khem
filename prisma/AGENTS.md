# AGENTS.md — KHEM Database Engineering Handbook (`prisma/`)

> **Scope:** everything that touches persistent data — Prisma ORM, PostgreSQL, Supabase, schema design, migrations, seeding, and database security.
> **Authority:** the root [`AGENTS.md`](../AGENTS.md) remains the single source of truth for the **application**. This file **specialises** those rules for the **data layer** and wins on database matters only. Where the two genuinely conflict, see §17 (Open Decisions) — do not silently pick a side.
> **Audience:** Claude Code, Copilot, Cursor, and human engineers.

---

## 0. READ THIS FIRST (AI agent preflight)

Before writing or modifying **any** database code, in this order:

1. Read the root [`AGENTS.md`](../AGENTS.md).
2. Read **this** file end to end.
3. Read `prisma/schema.prisma` (and every file under `prisma/schema/` if the multi-file layout is in use).
4. Read `prisma/migrations/` — most recent migration first — to understand what has already shipped.
5. Read `src/services/` and `src/types/` — the query layer and the type contracts the UI depends on.
6. Read `package.json` to confirm which Prisma/Supabase packages actually exist.
7. Read `.agents/skills/supabase` and `.agents/skills/supabase-postgres-best-practices` when the task touches Supabase, RLS, pooling, or raw SQL.

**Never** propose schema changes from memory of this document alone. The schema on disk is the truth; this document is the policy.

---

## 1. ARCHITECTURE — WHERE THE DATABASE SITS

### 1.1 Canonical data flow

```text
Next.js (App Router)
  ↓
Server Components / Server Actions / Route Handlers
  ↓
src/services/*        ← the ONLY layer allowed to import Prisma
  ↓
Prisma Client
  ↓
Supabase PostgreSQL
```

**Rules:**

* **Prisma is the primary and default ORM.** All application reads and writes go through Prisma.
* **Supabase provides the PostgreSQL instance** (plus Auth-adjacent infra we do not use, Storage we do not use, and Realtime we may use). Supabase is *infrastructure*, not the app's data access layer.
* **Do not mix Prisma and the Supabase JS client for the same data.** Reaching for `supabase.from('products')` in a component when a Prisma service exists is a bug, not a shortcut.
* **Clerk owns authentication.** Never store passwords, password hashes, sessions, MFA secrets, or OAuth tokens in PostgreSQL. The database stores a `clerkId` reference and nothing more.
* **Cloudinary owns media.** The database stores URLs / public IDs and metadata (alt text, dimensions, sort order) — never binary blobs.
* **Stripe owns payments.** The database stores Stripe object IDs, amounts, currency, and status — **never** card numbers, CVCs, expiry dates, or raw PAN in any form.
* **pgvector** is permitted for journal/article embeddings only (see §8.4).

### 1.2 Narrow exceptions where the Supabase client is allowed

Prisma cannot do these; the Supabase client may be used, isolated in `src/lib/supabase.ts`:

| Use case | Allowed | Notes |
| :--- | :--- | :--- |
| Realtime subscriptions (stock, order status) | ✅ | Read-only channels, anon key, client-side |
| Supabase Storage | ❌ | We use Cloudinary |
| Supabase Auth | ❌ | We use Clerk |
| General CRUD | ❌ | Use Prisma |
| Admin/service-role writes | ❌ | Use Prisma on the server |

Any use of the Supabase client must be documented in the file where it lives, with a one-line justification of why Prisma cannot serve the case.

---

## 2. TARGET DATA ARCHITECTURE

This is the intended domain model. It is a **map, not a schema** — do not treat any table below as existing until it is in `schema.prisma`.

```text
SITE
├── site_settings
├── homepage_sections
└── media

CATALOG
├── products
├── product_variants
├── product_images
├── collections
├── collection_products
├── fragrance_notes
├── product_fragrance_notes
├── ingredients
└── product_ingredients

CONTENT
├── pages
├── page_sections
├── heritage_sections
├── heritage_timeline
├── craftsmanship_sections
├── journal_posts
├── journal_categories
├── journal_post_categories
├── journal_tags
└── journal_post_tags

CUSTOMERS
├── customers
├── wishlists
├── wishlist_items
├── carts
└── cart_items

ORDERS
├── orders
├── order_items
├── order_addresses
├── payments
├── discounts
├── discount_products
└── discount_collections

INVENTORY
├── inventory
└── inventory_movements

BUSINESS
├── stockists
├── newsletter_subscribers
├── contact_messages
└── store_settings

SEO
└── seo_metadata
```

### 2.1 Domain boundaries and intent

| Domain | Owns | Key integrity concern |
| :--- | :--- | :--- |
| **SITE** | Global config, editable homepage composition, shared media records | Exactly one `site_settings` row; homepage sections ordered and toggleable |
| **CATALOG** | Products, the variants that are actually purchasable, imagery, taxonomy | A variant — not a product — is the sellable, priced, stocked unit |
| **CONTENT** | Static pages, heritage/craftsmanship narrative, journal | Slug uniqueness; published vs draft state |
| **CUSTOMERS** | Clerk-linked customer records, wishlists, carts | A cart is *live* and may legitimately change under the customer |
| **ORDERS** | Orders, line items, frozen addresses, payments, discounts | An order is *immutable history* and must never change when the catalog does |
| **INVENTORY** | Stock levels and an auditable movement ledger | Stock is derived from movements; never silently overwritten |
| **BUSINESS** | Stockists, newsletter, contact form, store-level operational settings | Email uniqueness; PII minimisation |
| **SEO** | Per-entity metadata | One metadata row per (entity type, entity id) |

### 2.2 Anti-overengineering rules

KHEM is built and maintained by a **solo developer**. Therefore:

* **Do not create a table for every visual section in Figma.** A section that renders fixed copy is code or a `page_sections` row — not a bespoke table.
* Prefer `page_sections` with a discriminating `type` + a validated `content Json` payload over five near-identical section tables. `heritage_sections`, `heritage_timeline`, and `craftsmanship_sections` are the *only* sanctioned bespoke exceptions, because their shapes are genuinely different and editorially rich.
* Do not add a table "for later". Add it when a feature needs it, in the same migration as the feature.
* Do not add speculative columns, polymorphic god-tables, or an EAV pattern.
* Normalise to 3NF **except** where the domain requires deliberate denormalisation for historical accuracy (order snapshots — §7).

---

## 3. DATABASE WORKFLOW (MANDATORY)

```text
Inspect
↓
Plan
↓
Modify schema.prisma
↓
prisma format
↓
prisma validate
↓
Generate migration
↓
Review migration
↓
Apply locally
↓
Test
↓
Commit migration
↓
Deploy migration to production
```

Non-negotiables at each stage:

1. **Inspect** — read the current schema and the last migrations. Never assume.
2. **Plan** — state, in prose, before touching a file: which models change, which columns are added/renamed/dropped, which indexes and constraints change, whether the change is backward compatible, and what the data-loss risk is.
3. **Modify** — edit `schema.prisma` only. Never hand-edit generated client code. Never hand-edit an already-applied migration.
4. **Format / Validate** — both must pass with zero output problems before a migration is generated.
5. **Generate migration** — always named, always descriptive: `add_product_variants`, not `update`.
6. **Review migration** — **open the generated SQL and read it.** If it contains `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or a type narrowing, stop and escalate to the user (§16).
7. **Apply locally** — against the development database only.
8. **Test** — run typecheck and lint; exercise the affected service functions.
9. **Commit** — the migration SQL **and** `schema.prisma` go into Git in the same commit. Migrations are never `.gitignore`d.
10. **Deploy** — production applies migrations with `migrate deploy`, never `migrate dev`, never `db push`.

---

## 4. COMMANDS

### 4.1 Safe in every environment

```bash
npx prisma format                 # Canonicalise schema.prisma formatting
npx prisma validate               # Static validation of the schema
npx prisma generate               # Regenerate Prisma Client types
npx prisma migrate status         # Show applied vs pending migrations (read-only)
npx prisma studio                 # Visual data browser — POINT IT AT DEV ONLY
```

### 4.2 Local development

```bash
npx prisma migrate dev --name <descriptive_name>   # Create + apply a migration locally
npx prisma migrate dev --create-only --name <n>    # Create the SQL WITHOUT applying it — preferred for review
npx prisma db seed                                 # Run prisma/seed.ts
npx prisma db pull                                 # Introspect an existing DB into the schema
```

`--create-only` is the preferred first step for any non-trivial change: it lets the SQL be reviewed (and hand-edited for a safe multi-step migration) before it ever runs.

### 4.3 Production

```bash
npx prisma migrate deploy         # Apply pending migrations. The ONLY production migration command.
npx prisma generate               # Runs as part of the build
```

Production deploys must run `migrate deploy` against `DIRECT_URL` (unpooled), not the pooled URL.

### 4.4 🚨 DEVELOPMENT-ONLY — DESTRUCTIVE — NEVER RUN AGAINST PRODUCTION

These **delete data**. An AI agent must **never** run any of these without an explicit, in-the-moment instruction from the user naming the command.

```bash
npx prisma migrate reset          # ⚠️ DROPS the database, re-applies all migrations, re-seeds
npx prisma db push                # ⚠️ Applies schema WITHOUT a migration; can silently drop columns
npx prisma db push --force-reset  # ⚠️ Drops everything first
npx prisma db execute --file ...  # ⚠️ Arbitrary SQL — review the file before running
```

**`prisma db push` is never the production migration strategy.** It is permitted only for throwaway local prototyping on a database whose contents you are willing to lose, and any schema arrived at via `db push` must be converted into a real migration before it is committed.

### 4.5 package.json wiring (to add when Prisma is installed)

```jsonc
{
  "prisma": { "seed": "tsx prisma/seed.ts" },
  "scripts": {
    "db:generate": "prisma generate",
    "db:validate": "prisma validate",
    "db:migrate":  "prisma migrate dev",
    "db:deploy":   "prisma migrate deploy",
    "db:status":   "prisma migrate status",
    "db:seed":     "prisma db seed",
    "db:studio":   "prisma studio"
  }
}
```

Note `tsx` is already a devDependency. Deliberately **not** scripted: `reset` and `push` — destructive commands should require typing out in full.

---

## 5. ENVIRONMENT VARIABLES

Only two database variables exist. Placeholders only — **never** commit real credentials, and never paste a real connection string into a prompt, a comment, a migration, or a commit message.

```bash
# Pooled connection (PgBouncer, transaction mode) — used by the Prisma Client at runtime.
# Serverless functions open many short-lived connections; the pooler is what keeps
# Postgres from exhausting its connection limit.
DATABASE_URL="postgresql://<user>:<password>@<host>:6543/postgres?pgbouncer=true&connection_limit=1"

# Direct, unpooled connection — used by Prisma Migrate and introspection only.
# Migrations need session-level features (advisory locks, DDL transactions) that a
# transaction-mode pooler does not support.
DIRECT_URL="postgresql://<user>:<password>@<host>:5432/postgres"
```

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**Rules:**

* Both are **server-only**. Never prefix either with `NEXT_PUBLIC_`. Never reference them in a `'use client'` file.
* Local values live in `.env.local` (git-ignored). A redacted `.env.example` with placeholder values is committed.
* Production values live in Vercel project environment variables, scoped per environment.
* Rotate immediately if a credential is ever printed to a log, a terminal transcript, or an AI conversation.
* Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are governed by §11 — the service-role key is **never** public and never reaches the browser.

---

## 6. PRISMA CONVENTIONS

### 6.1 Model naming

* Model names: **PascalCase, singular** — `Product`, `ProductVariant`, `OrderItem`.
* Physical table names: **snake_case, plural**, via `@@map` — `@@map("product_variants")`.
* Every model gets an explicit `@@map`. Never rely on the default.

### 6.2 Field naming

* Fields: **camelCase** in Prisma, **snake_case** in Postgres via `@map`.
* Booleans read as assertions: `isActive`, `isFeatured`, `isPublished`, `isDefault`.
* Foreign keys: `<relation>Id` — `productId`, `collectionId`.
* Money: `<thing>Amount` or a plain domain noun (`price`, `subtotal`, `total`), never `amt`.
* No abbreviations, no Hungarian notation, no `data`/`info`/`misc` columns.

### 6.3 Primary keys

```prisma
id String @id @default(uuid()) @db.Uuid
```

* **UUID for every primary key.** No auto-increment integers — they leak business volume and complicate merges.
* Join tables use a composite primary key of their two FKs (§6.6), not a surrogate id.
* Human-facing identifiers (`orderNumber`, `sku`, `slug`) are **separate unique columns**, never the primary key.

### 6.4 Timestamps

```prisma
createdAt DateTime  @default(now())  @map("created_at") @db.Timestamptz(6)
updatedAt DateTime  @updatedAt       @map("updated_at") @db.Timestamptz(6)
deletedAt DateTime?                  @map("deleted_at") @db.Timestamptz(6)
```

* **Always `@db.Timestamptz`.** Never `timestamp without time zone`. Never store a date as a string.
* Every table that is not a pure join table gets `createdAt` + `updatedAt`.
* `deletedAt` only where soft delete is the policy (§6.10).

### 6.5 Money

```prisma
price       Decimal @db.Decimal(12, 2)
currency    String  @default("USD") @db.Char(3)
```

* **Money is `Decimal` / `NUMERIC`. Never `Float`, never `Double`.** Floating point loses cents.
* `Decimal(12, 2)` unless a domain genuinely needs more scale.
* Every money column is accompanied by, or governed by, an explicit ISO-4217 currency code. Never assume the currency.
* Percentages (discounts, tax rates) are also `Decimal` — `Decimal(5, 2)` for `0.00`–`100.00`.
* In TypeScript, treat `Decimal` as `Prisma.Decimal`. Never do arithmetic by coercing to `number`. Format for display in `src/lib/format.ts` only.
* ⚠️ See §17.1 — this conflicts with the integer-cents convention currently in root `AGENTS.md` §9 and `src/types/catalog.ts`, and needs a decision before the first migration.

### 6.6 Relations

* Every relation is a **real foreign key**. No "logical" relations enforced only in application code.
* Name the relation field after the thing, not the table: `product`, `collection`, `variant`.
* Back-relations are plural for to-many: `products`, `items`, `images`.
* Use a named `@relation("...")` **only** when two relations between the same pair of models would otherwise be ambiguous.
* Many-to-many is always an **explicit join model** — never Prisma's implicit `m-n`. The join table needs its own columns (`sortOrder`, `createdAt`) sooner than you expect.

```prisma
model CollectionProduct {
  collectionId String     @map("collection_id") @db.Uuid
  productId    String     @map("product_id")    @db.Uuid
  sortOrder    Int        @default(0) @map("sort_order")
  createdAt    DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)

  collection   Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  product      Product    @relation(fields: [productId],    references: [id], onDelete: Cascade)

  @@id([collectionId, productId])
  @@index([productId])
  @@map("collection_products")
}
```

### 6.7 Cascade behaviour

Choose deliberately; state the reason in a comment when it is not obvious.

| Parent → child | `onDelete` | Why |
| :--- | :--- | :--- |
| `Product` → `ProductImage` | `Cascade` | Images have no meaning without the product |
| `Product` → `ProductVariant` | `Restrict` | A variant may be referenced by order history |
| `Collection` → `CollectionProduct` | `Cascade` | Pure join row |
| `Cart` → `CartItem` | `Cascade` | Cart is ephemeral |
| `Wishlist` → `WishlistItem` | `Cascade` | Same |
| `Customer` → `Order` | `Restrict` / `SetNull` | **Orders outlive customers.** Never cascade-delete orders |
| `Order` → `OrderItem` | `Cascade` | Items belong to exactly one order |
| `Order` → `OrderAddress` | `Cascade` | Frozen snapshot owned by the order |
| `Order` → `Payment` | `Restrict` | Financial record — never cascade away |
| `ProductVariant` → `Inventory` | `Cascade` | Stock record is meaningless without the variant |
| `Inventory` → `InventoryMovement` | `Restrict` | Ledger is an audit trail |

**Never `onDelete: Cascade` on anything reachable from an order or a payment.**

### 6.8 Indexes

Add an index when — and only when — a query actually needs it:

* **Every foreign key** used in a filter or join. (Postgres does not index FKs automatically.)
* **Every `slug`**, and every column used for lookup by a route param.
* Columns in frequent `WHERE` clauses: `isPublished`, `isActive`, `isFeatured`, `status`.
* Sort columns paired with their filter: `@@index([status, createdAt])` — order matters; the equality column comes first.
* Partial-index intent (e.g. "only non-deleted rows") is expressed via raw SQL appended to the migration, with a comment explaining it.

Do **not** index: low-cardinality booleans queried alone, columns never filtered on, or every column "just in case". Each index costs write throughput and storage.

### 6.9 Unique constraints

* Single-column unique: `slug`, `sku`, `orderNumber`, `email`, `clerkId`, `stripePaymentIntentId`, discount `code`.
* Composite unique wherever a pair must not repeat:

```prisma
@@unique([wishlistId, productVariantId])
@@unique([cartId, productVariantId])
@@unique([productId, fragranceNoteId])
@@unique([entityType, entityId])          // seo_metadata
```

* A composite unique that also serves as the natural key should be the `@@id` instead (join tables).

### 6.10 Nullability and deletion strategy

* **Default to `NOT NULL`.** A nullable column must have a documented meaning for `NULL` ("not yet shipped", "guest checkout"). `NULL` must never mean "we forgot".
* Prefer a sensible `@default` over nullability.
* **Soft delete** (`deletedAt`) for: `Product`, `ProductVariant`, `Collection`, `Customer`, `JournalPost`. These are referenced by history or by SEO-visible URLs.
* **Hard delete** for: cart items, wishlist items, join rows, and unconfirmed newsletter subscribers.
* **Never delete** — under any circumstance, including "cleanup": `Order`, `OrderItem`, `OrderAddress`, `Payment`, `InventoryMovement`.
* Soft-deleted rows must be filtered in the service layer (`where: { deletedAt: null }`). Centralise this — do not sprinkle it and hope.
* Archive (`isArchived`) ≠ delete: archived products stay queryable for order history and admin, but are excluded from storefront queries.

### 6.11 Enums

* Enum names: **PascalCase singular** — `OrderStatus`, `PaymentStatus`, `Concentration`, `DiscountType`, `MovementReason`.
* Enum values: **SCREAMING_SNAKE_CASE** — `EAU_DE_PARFUM`, `AWAITING_PAYMENT`.
* Enums are for closed, stable sets the code branches on. If merchandising needs to add values at will, it is a **lookup table**, not an enum.
* Removing or renaming an enum value is a breaking migration — see §16.

### 6.12 JSON columns

Permitted, sparingly, for genuinely variable editorial payloads (`page_sections.content`, `homepage_sections.content`). Rules:

* Every JSON column has a **Zod schema** in `src/schemas/` and is parsed on read and validated on write. No unvalidated JSON crosses the boundary.
* Never put queryable business data (prices, stock, status, foreign keys) in JSON.
* Type it as a discriminated union keyed on the row's `type` column.

---

## 7. ECOMMERCE DATA INTEGRITY (THE CRITICAL SECTION)

### 7.1 Products vs variants

**The `ProductVariant` is the sellable unit.** A product is the editorial identity (name, story, notes, imagery); a variant is what has a size, a price, a SKU, and stock.

* `price`, `compareAtPrice`, `sku`, `volumeMl`, and `concentration` live on the **variant**, not the product.
* Every product has **at least one** variant, even single-size products. No "implicit default variant" in code.
* `sku` is globally unique across variants.
* Cart items, wishlist items, order items, and inventory all reference **`productVariantId`**, never `productId`.
* A variant may be deactivated (`isActive = false`) or soft-deleted, but never hard-deleted once ordered.

### 7.2 Inventory

* Stock lives in `inventory`, one row per variant: `quantityOnHand`, `quantityReserved`, plus a derived available quantity. `available = quantityOnHand - quantityReserved`.
* **Every change to stock writes an `inventory_movements` row** — `delta`, `reason` (enum: `RESTOCK`, `SALE`, `RETURN`, `ADJUSTMENT`, `DAMAGE`, `RESERVATION_RELEASE`), `referenceType`/`referenceId`, `note`, `createdAt`, and the acting admin. The ledger is append-only and is the audit trail.
* Never set stock with a bare `update: { quantityOnHand: n }` from user input. Apply a **delta** inside a transaction, and re-read the row with row-level locking semantics.
* Decrementing stock and creating the order happen in **one `prisma.$transaction`**. Never two round-trips.
* Guard against oversell with a conditional update (`WHERE quantity_on_hand >= :qty`) and treat a zero-row result as an out-of-stock failure, plus a `CHECK (quantity_on_hand >= 0)` constraint at the database level.

### 7.3 Carts

* A cart is **live**: prices, availability, and product data are read fresh on every render. A cart item stores `productVariantId` + `quantity` and *nothing else* about the product.
* **Never store a price on a cart item.** The price is whatever the variant costs right now.
* Support both authenticated carts (`customerId`) and guest carts (opaque `sessionToken`). Exactly one of the two is set — enforce with a `CHECK`.
* Merge a guest cart into the customer cart on sign-in, summing quantities and respecting the `@@unique([cartId, productVariantId])` constraint via `upsert`.
* Carts expire. A `expiresAt` column plus a cleanup job is fine; deleting an abandoned cart is safe because it holds no history.

### 7.4 Orders — the immutability rule

> **An order must remain historically accurate even if a product is later renamed, repriced, archived, or deleted.**

This is the single most important rule in this document. It is implemented as **snapshotting**:

`order_items` stores, denormalised and frozen at purchase time:

| Column | Why |
| :--- | :--- |
| `productVariantId` (nullable FK, `onDelete: SetNull`) | Traceability *if* the variant still exists |
| `productName` | The name as sold |
| `variantName` / `volumeMl` / `concentration` | The size and format as sold |
| `sku` | The SKU as sold |
| `imageUrl` | The image as sold |
| `unitPrice` (`Decimal`) | The price as sold |
| `quantity` | — |
| `lineSubtotal`, `lineDiscount`, `lineTotal` (`Decimal`) | Computed at purchase, then frozen |

`order_addresses` is likewise a **frozen copy**, not a foreign key to a mutable customer address. Shipping and billing are separate rows (or separate typed columns) on the order.

`orders` stores frozen monetary totals: `subtotal`, `discountTotal`, `shippingTotal`, `taxTotal`, `grandTotal`, `currency`.

**Consequences, all mandatory:**

* Renaming a product never rewrites an order.
* Deleting a product is impossible while orders reference it (`Restrict`) — hence archive/soft-delete.
* Reading an order **never joins to `products` to display it**. If the order page needs a product join to render, the snapshot is incomplete.
* An order's monetary columns are written once. Corrections are new rows (refunds, adjustments), never `UPDATE`s of history. `status` and fulfilment fields are the only mutable parts.
* `orderNumber` (e.g. `KHEM-2026-8921`) is unique, human-facing, and generated server-side.

### 7.5 Pricing authority

> **Never trust a client-provided price, quantity total, discount, or grand total.**

* The server recomputes **every** monetary value from the database at checkout: variant prices, discount validity and amount, shipping, tax, totals.
* The client may send only: variant IDs, quantities, a discount **code** string, and an address.
* The Stripe amount is derived from the server-computed total, and the Stripe webhook is the authority on whether payment succeeded — never a client callback.
* Validate every inbound payload with Zod (`src/schemas/`) before it reaches Prisma. Quantities are positive integers with an upper bound.

### 7.6 Payments

* `payments` stores: `orderId`, `provider` (`STRIPE`), `stripePaymentIntentId` (unique), `stripeChargeId`, `amount` (`Decimal`), `currency`, `status` (enum), `failureReason`, `processedAt`, and raw-event metadata as `Json` if needed.
* **No card data. Ever.** Not PAN, not CVC, not expiry, not cardholder name from the card. Last-4 and brand are acceptable only as returned by Stripe for display.
* Webhook handlers must be **idempotent**: key on `stripePaymentIntentId` / Stripe event id with a unique constraint, and treat duplicate deliveries as no-ops.
* Payment status transitions are append-forward. A refund is a new payment row (or a refund row), not an edit.

### 7.7 Discounts

* `discounts`: `code` (unique, case-normalised), `type` (`PERCENTAGE` | `FIXED_AMOUNT` | `FREE_SHIPPING`), `value` (`Decimal`), `minimumSubtotal`, `startsAt`, `endsAt`, `usageLimit`, `usageCount`, `perCustomerLimit`, `isActive`.
* Scope via `discount_products` and `discount_collections`. No rows in either table = applies to everything.
* **Validity is evaluated server-side at checkout**, against the database clock — never from a client claim that a code is valid.
* `usageCount` increments inside the order transaction, with a `CHECK (usage_count <= usage_limit)` or a conditional update, so concurrent checkouts cannot exceed the limit.
* The applied discount is **snapshotted onto the order** (`discountCode`, `discountAmount`); changing or deleting the discount later must not alter past orders.

---

## 8. CONTENT, CMS, AND SUPPORTING DOMAINS

### 8.1 Editorial content

* `pages` + `page_sections` drive generic static pages: `slug` unique, `isPublished`, `publishedAt`, ordered sections with a `type` discriminator and Zod-validated `content Json`.
* `heritage_sections`, `heritage_timeline`, `craftsmanship_sections` are the sanctioned bespoke narrative tables. Each has `sortOrder` and `isPublished`.
* `journal_posts`: `slug` unique, `title`, `excerpt`, `body`, `coverMediaId`, `authorName`, `readingMinutes`, `status` (`DRAFT`/`PUBLISHED`/`ARCHIVED`), `publishedAt`. Categories and tags are many-to-many through explicit join tables.
* Content tables are **read-only from the storefront**. Writes come from the admin surface only.

### 8.2 Fragrance taxonomy

* `fragrance_notes` is a shared vocabulary table (`name` unique, `slug`, `family`, `description`, `imageUrl`).
* `product_fragrance_notes` joins product ↔ note with a `pyramid` enum (`TOP` | `HEART` | `BASE`) and `sortOrder`, unique on `[productId, fragranceNoteId, pyramid]`.
* This **replaces** the `topNotes String[]` / `heartNotes` / `baseNotes` arrays in the root schema draft — string arrays cannot be filtered, faceted, or linked to a note landing page. See §17.2.
* `ingredients` + `product_ingredients` follow the same pattern, with `origin` and sourcing copy on the ingredient.
* **Do not invent notes, ingredients, origins, prices, or fragrance compositions.** If the real data is unknown, leave the table empty and say so.

### 8.3 Business tables

* `stockists`: name, address fields, `country`, `latitude`/`longitude` (`Decimal`), `isActive`. Geo columns are `Decimal(9,6)`, not floats.
* `newsletter_subscribers`: `email` unique + citext-normalised, `status` (`PENDING`/`SUBSCRIBED`/`UNSUBSCRIBED`), `confirmedAt`, `unsubscribedAt`, `source`. Double opt-in. Honour unsubscribe permanently — status change, never a row delete, so re-subscription is auditable.
* `contact_messages`: PII-bearing. Store only what the form collects, add `status` for triage, and define a retention period. Never expose this table to any public read path.
* `site_settings` / `store_settings`: **singleton rows.** Enforce with a `CHECK` on a constant primary key (e.g. `id = 1` or a fixed uuid) so a second row cannot be inserted.

### 8.4 SEO and vectors

* `seo_metadata`: `entityType` (enum) + `entityId`, unique together, with `title`, `description`, `ogImageUrl`, `canonicalUrl`, `noIndex`. One generic table — do not add SEO columns to every entity.
* pgvector: enabled via a migration (`CREATE EXTENSION IF NOT EXISTS vector`), used for journal-article embeddings only. Prisma has no native vector type — declare it `Unsupported("vector(1536)")`, query it with `$queryRaw` **using parameterised values**, and keep the raw SQL inside `src/services/`.

---

## 9. TRANSACTIONS

Use `prisma.$transaction` — never a sequence of independent writes — for:

* Order creation: order + items + addresses + inventory decrement + movement rows + discount usage increment.
* Any stock mutation paired with a business event.
* Cart merge on sign-in.
* Any multi-table write where a partial success would corrupt state.

Rules:

* Prefer the **interactive** form (`$transaction(async (tx) => { ... })`) when later writes depend on earlier reads; use the array form for independent batched writes.
* Every write inside the transaction uses `tx`, never the global `prisma` client. Mixing them silently escapes the transaction — this is a common and severe bug.
* Keep transactions short. **No network I/O inside a transaction** — no Stripe calls, no Resend, no Cloudinary. Do external calls before or after, and design for idempotency.
* Set explicit `timeout` / `maxWait` for long transactions rather than relying on defaults.
* Handle serialisation failures and unique-constraint races explicitly; do not let `P2002` surface to the user as a 500.

---

## 10. PRISMA CLIENT & SERVER-ONLY ACCESS

### 10.1 Singleton (`src/lib/prisma.ts`)

```ts
import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

* Exactly **one** `PrismaClient` in the codebase. Never `new PrismaClient()` in a route, action, or service.
* `import "server-only"` at the top so a client import fails at build time.
* Never log queries in production — parameters can contain PII.

### 10.2 Access boundary

* Prisma may be imported **only** by `src/services/**`, `src/actions/**`, `src/app/api/**`, and `prisma/seed.ts`.
* **Components never import Prisma.** Pages and Server Components call service functions.
* Service functions return the narrow projection the UI needs (the `ProductCardData` pattern already established in `src/types/catalog.ts`) — never a raw model with every column.
* Never `select: '*'` by habit; enumerate the columns a query actually needs.
* Never interpolate user input into `$queryRawUnsafe`. Use `$queryRaw` tagged templates or `Prisma.sql` parameters.
* Wrap database calls in try/catch, map `PrismaClientKnownRequestError` codes to domain errors, and never leak a raw Prisma error message (which can contain column names and values) to the client.

---

## 11. SUPABASE, POOLING, AND SERVERLESS

### 11.1 Connection pooling

Vercel serverless functions scale horizontally; each instance holds its own connection. Postgres will exhaust `max_connections` without a pooler.

* **Runtime → pooled URL** (`DATABASE_URL`, port `6543`, `?pgbouncer=true&connection_limit=1`).
* **Migrations/introspection → direct URL** (`DIRECT_URL`, port `5432`).
* `connection_limit=1` per serverless instance is correct — parallelism comes from instance count, not from per-instance pool size.
* PgBouncer transaction mode does not support prepared statements or session state. If a query needs session-level features, it belongs in a migration, not in request handling.
* Long-running work does not belong in a request. Use a background job / cron.
* Keep queries indexed and narrow; a slow query holds a pooled connection hostage for everyone.

### 11.2 Row Level Security

Prisma connects with a privileged role and **bypasses RLS**. RLS is therefore *defence in depth*, not our primary authorisation mechanism — application-level authorisation in Server Actions and services is.

Policy:

1. **Enable RLS on every table.** A table with RLS enabled and no policy is deny-by-default, which is the correct posture for tables the anon key should never see.
2. Grant **no** anon/authenticated policies on: `orders`, `order_items`, `order_addresses`, `payments`, `customers`, `contact_messages`, `newsletter_subscribers`, `inventory`, `inventory_movements`, `discounts`, `site_settings`, `store_settings`.
3. Read-only `SELECT` policies for the anon role are acceptable **only** on genuinely public content, and only if the Supabase client actually needs them (e.g. Realtime): published products/variants/images/collections, published journal posts, fragrance notes, ingredients, active stockists.
4. Policies are written as SQL inside a Prisma migration (or `supabase/` migrations) and committed to Git. Never click policies into the dashboard — they will be lost and undocumented.
5. Every policy carries a comment stating who it is for and why.

```sql
-- Example, in a migration:
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public storefront may read live, non-deleted products only.
CREATE POLICY "public_read_published_products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (is_published = true AND deleted_at IS NULL);
```

### 11.3 Supabase keys

| Key | Exposure | Rule |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Fine |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Only safe because RLS is enabled everywhere |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Server-only, bypasses RLS. Never in a client file, never in `NEXT_PUBLIC_*`, never logged |
| `DATABASE_URL` / `DIRECT_URL` | **Secret** | Server-only |

If the service-role key or a connection string is ever exposed, **rotate it immediately** — removing it from the code is not sufficient.

---

## 12. SECURITY RULES

* **Authentication is Clerk's.** The database stores `clerkId` (unique, indexed) on `customers`. No passwords, no sessions, no tokens.
* **Authorisation is checked server-side, per request.** Every Server Action and Route Handler resolves the Clerk session first and scopes the query by the resolved customer id. Never accept a `customerId` from the client.
* Admin operations require an `ADMIN`/`SUPER_ADMIN` role check **in the action itself**, not only in middleware. Middleware protects routes; it does not protect a Server Action invoked from elsewhere.
* Every admin mutation that touches money, inventory, or orders is attributed (`actorId`) and logged.
* All external input validated with Zod before it reaches Prisma — including route params and search params.
* Never expose internal UUIDs where a slug or order number serves; never let an id from the URL select a row without an ownership check.
* PII minimisation: collect only what the feature needs; define retention for `contact_messages`; support deletion/anonymisation of a customer while **preserving order history** (null the FK, keep the frozen snapshot).
* No credentials in the repo, in comments, in migrations, in seed data, or in an AI conversation.
* Payment data: Stripe IDs and amounts only (§7.6).

---

## 13. SEED DATA (`prisma/seed.ts`)

* Seeds exist to make **local development** and **preview environments** usable. They are not a content management strategy.
* **Idempotent**: use `upsert` keyed on a natural unique field (`slug`, `sku`, `email`). Running the seed twice must not duplicate rows.
* Deterministic ids and slugs — no `Math.random()`, no `faker` for anything a test or a screenshot depends on.
* Seed order follows the dependency graph: settings → collections → fragrance notes → ingredients → products → variants → images → joins → inventory → content → journal.
* **Do not invent KHEM product names, prices, ingredients, or fragrance compositions.** Use only data already present in `src/data/products.ts` and `src/data/content.ts`, or data the user supplies. If something is missing, leave it out and report it — placeholder marketing copy that reads as real is worse than an empty table.
* Never seed: real customers, real orders, real payments, or anything with real PII.
* **Never run the seed against production.** Guard the script: refuse to run when `NODE_ENV === "production"` unless an explicit override env var is set.

---

## 14. DEVELOPMENT VS PRODUCTION WORKFLOWS

| | Development | Preview | Production |
| :--- | :--- | :--- | :--- |
| Database | Local Postgres or a dedicated Supabase dev project | Preview branch DB | Supabase production project |
| Migration command | `prisma migrate dev` | `prisma migrate deploy` | `prisma migrate deploy` |
| Reset allowed | ✅ | ✅ | ❌ **never** |
| `db push` allowed | ⚠️ throwaway prototyping only | ❌ | ❌ |
| Seeding | ✅ | ✅ | ❌ |
| Studio | ✅ | ⚠️ read-only care | ❌ |
| Query logging | ✅ | ❌ | ❌ |

* **Never point a local `.env.local` at the production database.** This is the most common way production data gets destroyed.
* Confirm which database you are connected to before any migration. If you cannot tell, stop.
* Production migrations run as part of the deploy pipeline, from committed migration files, against `DIRECT_URL`.
* Take/verify a backup before any migration that drops or narrows a column in production.
* Prefer **expand → migrate → contract** for breaking changes: add the new column, backfill, ship code that writes both and reads new, then drop the old column in a later migration. Never do all three in one deploy.

---

## 15. VERIFICATION CHECKLIST

Before declaring any database task complete:

- [ ] `npx prisma format` run, schema is canonical.
- [ ] `npx prisma validate` passes with no problems.
- [ ] `npx prisma generate` run; client types are current.
- [ ] Generated migration SQL was **read** and contains no unexpected destructive statement.
- [ ] Migration applied locally and the affected feature exercised.
- [ ] `npx tsc --noEmit` passes (database types flow into application code).
- [ ] `npm run lint` passes.
- [ ] Every new FK that is filtered/joined has an index.
- [ ] Every money column is `Decimal`, never `Float`.
- [ ] Every timestamp is `Timestamptz`.
- [ ] Order/payment history remains immutable and un-cascaded.
- [ ] No client-supplied price, total, or `customerId` is trusted anywhere.
- [ ] No secret is present in schema, migration, seed, or code.
- [ ] RLS enabled on new tables; policies written in the migration.
- [ ] Migration **and** `schema.prisma` committed together.

---

## 16. AI CODING AGENT RULES (BINDING)

1. **Read both `AGENTS.md` files before any database work.** Root first, then this one.
2. **Inspect the existing schema and migrations before modifying anything.** Never write schema from memory of this document.
3. **Never overwrite, edit, delete, or renumber an existing migration.** Applied migrations are immutable history. Corrections are new migrations.
4. **Never delete or rename a model, field, or enum value without first explaining the migration impact** — what data is lost, what code breaks, whether it is reversible — and getting explicit approval.
5. **Never invent relationships.** If the relationship between two entities is not defined by the user or already in the schema, ask.
6. **Never invent business requirements** — pricing rules, tax logic, discount semantics, shipping tiers, fragrance data. Ask.
7. **Never make a destructive change automatically.** `DROP`, `TRUNCATE`, `migrate reset`, `db push --force-reset`, type narrowing, `NOT NULL` on an existing populated column: stop and ask, quoting the exact SQL.
8. **Explain schema changes before applying them** — affected models, new/changed columns, indexes, constraints, cascade behaviour, data-loss risk, backward compatibility.
9. **Run `prisma validate` after every schema change.**
10. **Run TypeScript checks** whenever database changes touch application code.
11. **Keep migrations reversible where practical** — additive first, prefer expand/contract, note in the migration when a step is irreversible.
12. **Keep the schema understandable to a solo developer.** Clarity beats cleverness. If a model needs a paragraph to justify itself, it is probably wrong.
13. **Follow the root `AGENTS.md` workflow**: for implementation requests, write the prompt file in `prompts/` and get approval before writing schema or migrations.
14. **Report, don't paper over.** If the data needed to complete a task does not exist, say so; do not fabricate rows, prices, or compositions to make output look finished.

---

## 17. OPEN DECISIONS — REQUIRE USER APPROVAL BEFORE THE FIRST MIGRATION

These are genuine conflicts between the root `AGENTS.md`, the target architecture, and the code already in the repo. **Do not resolve them unilaterally.**

**17.1 — Money representation.** Root `AGENTS.md` §9 and `src/types/catalog.ts` use `priceInCents Int`. The target architecture mandates `Decimal`/`NUMERIC`. This file currently specifies **`Decimal(12, 2)`**. Choosing Decimal requires updating root §9, `src/types/catalog.ts`, `src/data/products.ts`, and `src/lib/format.ts`. Both are defensible; integer cents is also non-lossy. **Pending.**

**17.2 — Fragrance notes.** Root §9 stores `topNotes String[]` / `heartNotes` / `baseNotes` on `Product`. The target architecture uses `fragrance_notes` + `product_fragrance_notes`. This file specifies the relational form (needed for faceted filtering, per the `/perfumes` route spec). This changes the `Product` type consumed by `ProductCard`. **Pending.**

**17.3 — Product vs variant.** Root §9 puts `priceInCents`, `sku`, `volumeMl`, `inventory`, and `concentration` on `Product`. The target architecture moves them to `product_variants` + `inventory`. This file specifies variants. Root §9 needs updating to match. **Pending.**

**17.4 — `User` vs `customers`.** Root §9 defines a `User` model; the target architecture names it `customers`. This file assumes **`Customer`** (model) → `customers` (table), Clerk-linked. **Pending.**

**17.5 — Prisma directory location.** This file lives at the repo root `prisma/`, matching root `AGENTS.md` §7 and Prisma CLI defaults. The instruction file currently sits at `src/prisma/AGENTS.md`. If the schema should instead live under `src/prisma/`, `package.json` needs an explicit `prisma.schema` path. **Pending.**

**17.6 — Environment variables.** `.env.local` currently contains `SUPBASE_URL` / `SUPBASE_KEY` / `SUPBASE_PASSWORD` (note the typo) and **no `DATABASE_URL` or `DIRECT_URL`**. These must be added before any Prisma command will run. **Pending.**

**17.7 — Packages not installed.** `prisma`, `@prisma/client`, `zod`, and `server-only` are absent from `package.json`. Nothing in this handbook is executable until they are added. **Pending.**

---

*End of `prisma/AGENTS.md` — KHEM Database Engineering Handbook. Root [`AGENTS.md`](../AGENTS.md) governs the application; this file governs the data.*
