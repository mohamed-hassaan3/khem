# Product, Landing Page, Navigation & Inventory Updates

## IMPORTANT — BEFORE STARTING

* Read `AGENTS.md` and all relevant existing UI/design documentation before making changes.
* Inspect the current implementation, database schema, Supabase functions, and existing admin architecture first.
* Do not remove or break existing working functionality.
* Reuse the existing patterns and components where possible.
* After implementation, test desktop and mobile layouts.
* Check for database side effects before performing any reset or inventory operation.
* Preserve all product data, images, SEO data, and administrator access unless explicitly requested otherwise.

---

# 1. PRODUCT DETAILS

## A. Remove Image Scroll Arrows

Remove the two arrow controls currently used to scroll/navigate the product images.

Apply this consistently across **all product detail pages and product types**.

The gallery should continue to work correctly without these arrow controls.

---

## B. Fix Mobile Eyebrow Layout

On mobile, specifically review:

```text
ritual/[slug]
```

Under the product image, eyebrow/category texts can currently appear too close together or overlap.

For example:

```text
SCENT YOUR SANCTUARY
HOME FRAGRANCES COLLECTION
```

Fix the mobile layout so these texts have proper hierarchy, spacing, and readability.

They must not overlap or visually stack on top of each other incorrectly.

---

## C. Update Product Benefits / Trust Messages

Add a clear **No Blind Buy** message.

The concept is:

> Customers can try a tester/sample before opening the full-size perfume.

The exact implementation and wording should match the existing KHEM design and product experience.

Also change:

```text
30-Day Returns
```

to:

```text
7-Day Returns
```

Audit all locations where the old return period appears, including product pages and any reusable trust/benefit components.

---

# 2. INGREDIENTS CARD — PRODUCT TYPE DETECTION

When the Ingredients card opens, make sure the system correctly identifies the actual product type.

This is important because the same product name may exist across multiple product types.

For example, a name may exist as:

* Perfume
* Body Mist
* Room Spray

The Ingredients card must not incorrectly assume that every product is a perfume.

It should use the actual product data/type/category to correctly display and contextualize:

* Perfume
* Body Mist
* Room Spray
* Any future product type

Do not rely only on the product name.

Audit the data model and use a reliable product identifier/type/category.

---

# 3. NAVIGATION & FOOTER — PREPARE FOR FUTURE CATEGORIES

Update both the **Navigation and Footer** structure.

Currently:

* Fragrances has expandable/collapsible navigation
* Profile Scent has expandable/collapsible navigation

Make the following parent categories work in the same scalable way.

## Body Care

Parent category:

```text
BODY CARE
```

Expandable child:

```text
Body Mist
```

Structure:

```text
BODY CARE
└── Body Mist
```

## Home Fragrances

Parent category:

```text
HOME FRAGRANCES
```

Expandable child:

```text
Room Spray
```

Structure:

```text
HOME FRAGRANCES
└── Room Spray
```

Use the same arrow/collapse interaction pattern already used for other expandable categories.

### Future-Proof Requirement

The structure must be dynamic and ready for future additions.

For example:

```text
BODY CARE
├── Body Mist
├── Body Cream
└── Future Category
```

And:

```text
HOME FRAGRANCES
├── Room Spray
├── Candle
└── Future Category
```

Do not hardcode the architecture in a way that requires rebuilding the navigation later.

---

# 4. LANDING PAGE — FULL CMS CONTROL

## A. Full Section Control

I need full control over the entire Landing Page from the Admin Dashboard.

The landing page should remain divided into sections, but the admin must be able to manage those sections.

For each landing page section, I need the ability to:

* Edit the section content
* Enable or disable/remove the section from the landing page
* Move the section up
* Move the section down
* Control section order
* Manage section-specific content and settings

The system should preserve the existing design architecture but make the page fully manageable.

Do not create a completely separate landing page system if an existing CMS/content architecture can be extended properly.

---

## B. New Arrival Section

The New Arrival section currently allows selecting a featured perfume from Settings.

That existing capability is useful, but move/integrate this control properly into the **Landing Page management system**.

The New Arrival section should support the existing featured product functionality while being managed as part of the landing page.

Additionally, allow the section to support:

* Image content
* Video content

The admin should be able to select the appropriate supported media for the section.

Ensure video support is implemented correctly with:

* Good loading performance
* Responsive behavior
* Proper mobile support
* No unnecessary performance regression

---

## C. Signature Scent & KHEM Journal Layout

On the Landing Page, review the sections:

* Signature Scent
* KHEM Journal

I want their content/cards to scroll horizontally in **one row** rather than wrapping into multiple rows.

Requirements:

* Horizontal scrolling behavior
* One continuous row
* Responsive behavior
* Good mobile experience
* Preserve KHEM design system

Do not introduce awkward horizontal page overflow.

---

# 5. INVENTORY ADMIN — ADD OFFLINE CHANNEL

In the Inventory Admin, add an **OFFLINE channel**.

The current Online/Offline concept used in Orders is a useful reference, but Inventory needs its own proper stock management architecture.

The goal is to control all stock from one place.

## Online Inventory

Online sales should automatically reduce Online stock when a successful sale/order occurs.

## Offline Inventory

Offline sales will be managed manually.

At the end of each day, I need to be able to record offline sales.

For example:

```text
Product: X
Offline Sale: -3
```

The Offline stock should then decrease accordingly.

---

## Stock Additions

When new stock arrives, I need to be able to add inventory.

For example:

```text
Product: X
Offline Stock Added: +20
```

The system must record the stock change.

---

## Inventory History / Story

I need a complete history of stock movement.

For every inventory change, store information such as:

* Product
* Channel: Online or Offline
* Action
* Quantity change
* Previous quantity
* New quantity
* Reason/source
* Date and time
* Related order when applicable

Examples:

```text
Offline sale: -3
New stock received: +20
Online order: -1
Manual adjustment: +2
```

The inventory system should provide a clear audit trail.

Do not simply overwrite stock quantities without recording the movement.

Design this as a scalable inventory ledger/history system.

---

# 6. RESET TEST DATA + INITIAL INVENTORY

I need to reset the testing data from the system.

## Remove Testing Data

Delete/reset testing data related to:

* Customers
* Customer emails
* Subscribers
* Test orders
* Sold items
* Comments
* Other test-user-generated data

Audit all customer/testing-related tables and remove the appropriate test data consistently.

---

## DO NOT DELETE

Preserve:

* Administrator account/email
* Admin access
* Products
* Product data
* Product images
* Product media
* Collections
* Categories
* Website content
* Existing CMS configuration where appropriate
* Other essential production configuration

Before performing deletion, identify the admin account correctly and protect it explicitly.

Do not use a dangerous broad delete operation without verification.

---

## INITIAL INVENTORY

After the reset, initialize inventory as follows.

### Offline Stock

For every product:

```text
55 pieces
```

Except:

* Gift Sets → `10`
* Discovery Sets → `10`

### Online Stock

For every product:

```text
5 pieces
```

Including:

* Gift Sets → `5`
* Discovery Sets → `5`

Make sure the Online and Offline channels are initialized correctly and independently.

Also create proper inventory history records for these initial stock entries so the audit trail starts cleanly.

---

# 7. PGVECTOR & PRODUCT RECOMMENDATIONS

Audit the existing PostgreSQL `pgvector` implementation.

Confirm that it is working correctly for product recommendations/suggestions.

Check:

* Vector generation
* Embeddings
* Product indexing
* Similarity search
* Query correctness
* Filtering
* Performance
* Product relevance
* Error handling
* Fallback behavior

Do not assume it is working simply because the extension is installed.

Actually verify the complete recommendation pipeline.

---

## Product Suggestions on Product Details

Currently, product suggestions show:

```text
3 products
```

Change the system to support:

```text
4 products
```

However, recommendations should remain intelligent.

If `pgvector` can reliably determine better recommendations, use the relevant similarity results.

The recommendation system should ideally:

1. Find relevant/similar products using `pgvector`
2. Filter out the currently viewed product
3. Respect product availability/status
4. Return the best relevant products
5. Display up to 4 products

If fewer than 4 suitable recommendations exist, use a sensible fallback rather than showing broken or irrelevant products.

The system should not blindly return exactly four unrelated products.

---

# FINAL AUDIT REQUIREMENTS

After completing everything:

## Product Experience

Verify:

* All product types
* Perfumes
* Body Mist
* Room Spray
* Gift Sets
* Discovery Sets
* Desktop
* Mobile

## Navigation

Verify:

* Navigation
* Footer
* Collapse behavior
* Future category scalability

## Landing Page

Verify:

* Section ordering
* Section removal/hiding
* Section editing
* Featured products
* Video support
* Horizontal rows
* Mobile behavior

## Inventory

Verify:

* Online stock reduction
* Offline manual sales
* Stock additions
* Inventory history
* Correct initial quantities
* No accidental stock duplication

## Data Reset

Verify:

* Admin account remains intact
* Products remain intact
* Product images remain intact
* Testing customer data is removed correctly
* No important production configuration is accidentally deleted

## pgvector

Verify:

* Embeddings exist where required
* Similarity queries work
* Results are relevant
* Current product is excluded
* Up to 4 recommendations can be returned
* Fallback behavior works

---

# IMPORTANT IMPLEMENTATION RULE

Before changing the database or deleting data:

1. Inspect the current schema.
2. Identify relationships and foreign keys.
3. Determine exactly which tables contain testing/customer-generated data.
4. Protect administrator data.
5. Create a safe, reversible plan where possible.
6. Verify the results after execution.

Do not guess database structure.

Do not introduce breaking schema changes without checking the existing application code.

At the end, provide a clear summary of:

* What was changed
* Database changes
* Data deleted/reset
* Inventory initialized
* Files/components changed
* Any migration created
* pgvector verification results
* Any remaining recommendations or issues
