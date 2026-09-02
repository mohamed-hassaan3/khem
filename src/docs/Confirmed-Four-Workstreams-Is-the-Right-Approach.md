# Confirmed — Four Workstreams Is the Right Approach

Yes, the four-file split is correct and much safer than one giant implementation task.

Please proceed with:

1. `product-detail-gallery-eyebrow-trust.md`
2. `nav-footer-category-groups.md`
3. `inventory-channels-and-ledger.md`
4. `landing-page-cms-sections.md`

A few clarifications below.

---

## 1. Landing CMS Scope

For this workstream, keep the existing typed dictionaries and editorial content structure.

I want the Landing Page CMS to control:

* Section order
* Move sections up/down
* Enable/disable section visibility
* Remove supported sections from the active page layout
* Per-section settings
* Featured products
* Images/media
* Video where applicable

Do **not** move the entire ~3,500 lines of editorial copy into database tables as part of this workstream.

A complete migration of every heading, paragraph, and translation into the CMS is a separate future project.

I do not want to risk the current content integrity or Arabic fallback/compile-time guarantees during this implementation.

---

## 2. Online vs Offline Stock

The Online and Offline channels should be independent.

Example:

```text
Online: 5
Offline: 55
```

If Online stock reaches:

```text
0
```

the storefront should show the product as:

```text
Sold Out
```

even if Offline stock still has units.

Online stock should **not automatically draw from Offline stock**.

However, I want a proper stock transfer action between channels.

Example:

```text
Transfer:
Offline → Online
10 units
```

This must:

* Reduce Offline stock by 10
* Increase Online stock by 10
* Record both movements in the inventory ledger/history
* Record the reason as a stock transfer

Online orders automatically reduce Online stock only.

Offline sales are entered manually and reduce Offline stock only.

---

## 3. Reset Target

The reset target is the **Production Supabase project**.

The administrator account that must be protected is:

```text
mmhassaan3@gmail.com
```

However, do **not** execute the destructive reset immediately.

First:

1. Inspect the exact production project and schema.
2. Identify all affected tables and relationships.
3. Create or confirm an available backup before deletion.
4. Give me a clear summary of exactly what will be deleted.
5. Wait for my explicit approval before running any destructive operation.

Do not run `DELETE`, `TRUNCATE`, or destructive migrations until I explicitly approve after reviewing the plan.

The following must remain protected:

* Admin account
* Admin access
* Products
* Product data
* Product images and media
* Collections
* Categories
* Essential CMS content
* Essential production configuration

---

## 4. Ingredients Card Issue

The problem is related to products that share the same base name across multiple product types.

For example, a product such as `VOLVE` may exist as:

* Perfume
* Body Mist
* Room Spray

Please inspect the exact screen/component where the issue occurs.

I want you to verify whether any lookup, matching, route, recommendation, or UI logic is using the product name alone.

Products must always be identified through reliable unique data such as:

* Product ID
* Unique slug where appropriate
* Product type/category
* Variant/product identifier

Do not change the implementation blindly if the existing data path is already type-correct.

First identify the exact issue and report the current data path.

---

## Recommendation Limit

For the first workstream, you can include the UI/display change from:

```text
3 recommendations
```

to:

```text
up to 4 recommendations
```

The full `pgvector` infrastructure and recommendation-quality audit should remain a separate verification task if it requires deeper database, embedding, or search infrastructure work.

The system should display up to 4 relevant recommendations, exclude the current product, and use sensible fallback behavior if fewer suitable results are available.
