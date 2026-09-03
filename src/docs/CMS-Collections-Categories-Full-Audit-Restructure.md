# CMS Collections & Categories — Full Audit and Restructure

We need to restructure and audit the entire **Products / Categories / Collections** system so it follows one clear hierarchy and is easy to manage in the CMS.

## Current problem

When I create a new collection, I can add products and configure it to appear in the navigation and footer, but there is no proper CMS-managed link to reach that collection. Currently, I have to manually write the URL/slug.

Example:

* **Body Care** → Category

  * **Body Mist** → Collection
  * **Body Cream** → Collection

If I create a new collection such as **Body Cream**, add products, and add it to the navigation, everything may appear correctly, but the CMS/navigation structure does not properly connect the menu item to the newly created collection automatically.

## Required structure

We need a clear hierarchy:

* **Fragrances** → Category

  * **NOIR** → Collection
  * Other fragrance collections → Collection

* **Body Care** → Category

  * **Body Mist** → Collection
  * **Body Cream** → Collection

* Other Categories

  * Their own Collections

### Important rule

Every collection must be a real, separate, reachable entity with its own:

* Name
* Slug / URL
* Collection page
* Category relationship
* Products
* Navigation destination
* Footer destination

When creating a new collection in the CMS, it should automatically have a valid destination/page. Navigation and footer items should be able to select and link directly to that collection without manually typing a URL.

## Full audit required

Before changing the architecture, perform a complete audit of:

* All existing products
* All categories
* All collections
* Product-to-collection relationships
* Product-to-category relationships
* Navigation links
* Footer links
* Existing slugs and routes
* CMS forms and database structure
* Any hardcoded collection/category URLs
* Any old structure that conflicts with this new plan

Identify anything that is disconnected, duplicated, incorrectly related, hardcoded, or incompatible with the new hierarchy.

## Important

Do not blindly rebuild the system or damage existing products, data, SEO, URLs, or working routes.

First understand the current architecture and compare it against the new plan.

Then implement the cleanest solution so that:

1. Categories and collections are clearly separated.
2. Every collection belongs to the appropriate category.
3. Every collection has a managed slug and reachable page.
4. Navigation can link directly to categories or collections through CMS selection.
5. Footer can link directly to categories or collections through CMS selection.
6. Creating a new collection does not require manually entering a URL.
7. Products remain correctly connected after the restructure.
8. Existing working data is safely migrated if changes are required.
9. Old or unused relationships are cleaned up only when confirmed safe.
10. The CMS terminology and UI become clear and not confusing.

### Final verification

After implementation, test the complete flow:

**Create Category → Create Collection under Category → Add Products → Publish Collection → Add Collection to Navigation/Footer → Click Link → Correct Collection Page Opens**

Also test all existing categories, collections, products, navigation links, and footer links to ensure nothing from the previous structure was broken.

Do a final audit after implementation and report any remaining inconsistencies or risks.

## Additional Bugs and CMS Fixes

### 1. New Arrival — Visibility / Selection Bug

There is a bug in the **New Arrival** section.

Currently, if I select **None/Hide**, then later change the selection back to:

* Film
* Image
* Featured

the New Arrival section never appears again.

**Fix this issue.**

Also, remove the **None/Hide option from this selection list entirely**, because each section already has its own dedicated **Hide/Show control**. We should not have two different systems controlling visibility.

The content type selector should only handle the actual content types:

* Featured
* Image
* Film

Visibility should be controlled only by the dedicated **Show/Hide control**.

### 2. Banner Visibility Logic

I noticed another issue with the banner:

* When I select **Show Header** or **Show Description**, the banner appears.
* If neither option is selected, the banner disappears.

Audit this logic carefully.

The banner/content section should not accidentally depend on whether the Header or Description is enabled. These controls should only determine whether those specific elements are displayed.

Make sure the section visibility works independently and consistently.

### 3. Remove Ingredients Labels

Remove the unnecessary **Ingredients labels** from the relevant CMS/UI area.

Do not remove the actual ingredients data if it is needed elsewhere—only remove the unnecessary visible labels/UI if that is what currently appears.

### 4. Admin Products — Search UI Bug

There is also a visual/UI bug in:

**Admin → Products → Search**

The search writing/text is conflicting or overlapping.

Audit the search input and surrounding UI across responsive screen sizes and fix the layout so that:

* Text does not overlap.
* Placeholder and entered text display correctly.
* Icons do not conflict with text.
* The search field works properly on desktop, tablet, and mobile.

Do a final UI and functional check after fixing all of these issues.
