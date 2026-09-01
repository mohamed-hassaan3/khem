Below is the **updated final MD prompt for Claude**. It combines:

1. Full Admin Dashboard sidebar reorganization.
2. CMS / Content architecture from the previous MD.
3. Campaign email improvements.
4. Promotion terminology fixes.
5. Full audit before implementation.
6. Supabase data safety before deployment.

You can save it as something like:

# `docs/ADMIN-CMS-FINAL-ARCHITECTURE.md`

---

````md
# KHEM — Final Admin Dashboard & CMS Architecture

## Mission

This is the final major organization and architecture phase before preparing the KHEM web application and Supabase database for production deployment.

The goal is to transform the existing Admin Dashboard into a clean, scalable, team-friendly control center.

The dashboard must be organized by **business function and website structure**, not simply by individual database tables or features.

The final system must allow the KHEM team to easily manage:

- Commerce
- Customers
- Products
- Inventory
- Marketing
- Discounts
- Promotions
- Email campaigns
- Website content
- World of KHEM pages
- Analytics
- Settings

Supabase remains the production source of truth.

---

# IMPORTANT: READ BEFORE STARTING

Before making changes, inspect the complete existing project.

Read and follow:

- `AGENTS.md`
- all UI/design MD files
- Supabase documentation
- database documentation
- existing migrations
- existing seed files
- Admin Dashboard architecture
- existing CMS/content implementation
- authentication and authorization implementation
- email/campaign implementation
- newsletter/subscriber implementation

Do not blindly redesign or duplicate existing functionality.

First understand:

1. The current database structure.
2. The current Admin Dashboard routes.
3. The existing sidebar/navigation architecture.
4. Existing content management functionality.
5. Existing email campaign functionality.
6. Existing promotions and discounts functionality.
7. Existing RLS/security policies.
8. The relationship between the public website and Supabase.

---

# PHASE 1 — FULL AUDIT FIRST

Before implementation, audit the entire Admin Dashboard.

Identify every current top-level sidebar item.

For example, currently there may be items such as:

- Dashboard
- Orders
- Customers
- Credits
- Discounts
- Promotions
- Announcements
- Newsletter
- Campaigns
- Inventory
- Analytics
- Collections
- Products
- Journal
- Content
- Stockists
- Settings

Determine:

- What each section does.
- Which database tables it uses.
- Whether it belongs under another category.
- Whether functionality is duplicated.
- Whether navigation terminology is confusing.
- Whether the current location makes sense for a team member.

Do not change the architecture until the audit is complete.

---

# PHASE 2 — FINAL SIDEBAR ARCHITECTURE

Reorganize the Admin Dashboard using logical business categories.

The final sidebar should conceptually follow this structure.

---

## 1. DASHBOARD

```text
Dashboard
````

The central overview of KHEM.

Possible future information:

* Revenue
* Orders
* Customers
* Inventory alerts
* Recent activity
* Campaign performance

Do not unnecessarily build new analytics during this task unless required by the existing implementation.

---

# 2. COMMERCE

Everything directly related to selling and managing the product catalog.

```text
COMMERCE

├── Orders
├── Customers
├── Products
├── Collections
├── Inventory
└── Stockists
```

Audit the existing functionality and preserve all routes/data.

The visible Admin Dashboard organization may change without unnecessarily changing the underlying database schema.

---

# 3. MARKETING

Group customer engagement and marketing activity together.

```text
MARKETING

├── Promotions
├── Discounts
├── Credits
├── Campaigns
├── Newsletter
└── Announcements
```

The purpose is to avoid having all of these items separately scattered across the sidebar.

The exact sub-navigation should follow existing UI patterns.

Do not duplicate the existing functionality.

---

# 4. CONTENT

The Content area is the KHEM CMS.

This should represent the structure of the public website.

```text
CONTENT

├── Landing Page
│
├── World of KHEM
│   ├── Heritage
│   ├── Craftsmanship
│   ├── Ingredients
│   ├── Journal
│   └── About KHEM
│
├── Navigation
└── Global / SEO Content
```

The exact structure should be based on the actual existing website pages discovered during the audit.

---

# 5. ANALYTICS

All monitoring and business performance data belongs under Analytics.

```text
ANALYTICS

├── Sales
├── Customers
├── Products
├── Marketing
└── Reports
```

Do not create empty pages unnecessarily.

Audit the existing analytics implementation and organize existing functionality correctly.

Future analytics should be able to expand under this category.

---

# 6. SYSTEM

```text
SYSTEM

└── Settings
```

Future settings may include:

* Store settings
* Users and roles
* Localization
* Shipping
* Payments
* Taxes
* Other configuration

Use the actual existing implementation.

---

# IMPORTANT SIDEBAR PRINCIPLE

Do not think:

> "Which database table is this?"

Think:

> "What job does the KHEM team want to do?"

For example:

```text
I want to manage products.
→ Commerce → Products

I want to create a discount.
→ Marketing → Discounts

I want to send an email campaign.
→ Marketing → Campaigns

I want to edit the Heritage page.
→ Content → World of KHEM → Heritage

I want to see sales performance.
→ Analytics → Sales
```

This must be the guiding principle for the Admin Dashboard.

---

# PHASE 3 — CONTENT CMS ARCHITECTURE

The current generic Content section is becoming mixed and confusing.

Content must be reorganized into a page-based CMS.

---

# LANDING PAGE

The Admin Dashboard must contain:

```text
Content
→ Landing Page
```

When entering Landing Page, show the actual editable sections of the public landing page.

Example:

```text
Landing Page

├── Hero
├── Introduction
├── Featured Collections
├── Heritage / Story Section
├── Craftsmanship Section
├── Ingredients Section
├── Featured Products
├── Journal / Editorial
├── CTA
└── Other actual landing page sections
```

IMPORTANT:

Do not invent unnecessary sections.

Audit the real landing page and use the actual sections implemented in the application.

Each section should be clearly editable.

Example:

```text
Content
→ Landing Page
→ Hero
→ Edit Hero Content
```

The team must immediately understand what website area they are editing.

---

# WORLD OF KHEM

Replace the confusing mixed content structure with:

```text
Content
→ World of KHEM
```

When entering World of KHEM, display:

```text
World of KHEM

[ Heritage ]

[ Craftsmanship ]

[ Ingredients ]

[ Journal ]

[ About KHEM ]
```

Each item represents its own public website page.

---

## HERITAGE

```text
Content
→ World of KHEM
→ Heritage
```

Manage all appropriate Heritage page content.

For example:

* Hero
* Story
* Historical sections
* Figures
* Images
* Quotes
* SEO

Only use sections that actually exist in the project.

---

## CRAFTSMANSHIP

```text
Content
→ World of KHEM
→ Craftsmanship
```

Manage existing craftsmanship content such as:

* Hero
* Craft Pillars
* Craft Figures
* Perfumer's Quote
* Other existing craftsmanship sections
* SEO

The existing items must no longer feel randomly placed under a generic Content page.

They should appear under the logical page they belong to.

---

## INGREDIENTS

```text
Content
→ World of KHEM
→ Ingredients
```

Manage:

* Hero
* Introduction
* Ingredient entries
* Featured ingredients
* Images
* Other existing sections
* SEO

Repeatable ingredients should have proper CRUD functionality where appropriate.

---

## JOURNAL

Journal belongs under:

```text
Content
→ World of KHEM
→ Journal
```

It must remain a proper publishing system.

The team should be able to:

* Create articles
* Edit articles
* Publish/unpublish
* Manage images
* Manage author information
* Manage dates
* Manage categories/tags if supported
* Manage SEO

Do not unnecessarily duplicate the existing Journal implementation.

---

## ABOUT KHEM

```text
Content
→ World of KHEM
→ About KHEM
```

Manage content belonging specifically to the About KHEM page.

For example:

* Hero
* Brand story
* Mission statements
* Vision
* Other existing sections
* SEO

---

# CMS PRINCIPLE

The CMS navigation should conceptually work like this:

```text
I want to edit something
        ↓
Which website area?
        ↓
Landing Page
OR
World of KHEM
        ↓
Which page?
        ↓
Heritage
Craftsmanship
Ingredients
Journal
About KHEM
        ↓
Which section?
        ↓
Hero
Story
Craft Pillars
Mission
Quote
etc.
        ↓
EDIT → SAVE → LIVE
```

---

# PHASE 4 — CAMPAIGNS EMAIL IMPROVEMENTS

Audit the existing Campaigns functionality.

Do not break previously sent campaigns or existing campaign records.

---

## CHANGE 1 — "SEND NOW" TERMINOLOGY

Currently, the campaign action may be called:

```text
Send Now
```

Replace this with:

```text
Send Subscribers
```

However, the final UI should clearly support multiple audience options described below.

---

## CHANGE 2 — SEND SPECIFIC EMAILS

Add a new campaign action:

```text
Send Specific
```

This allows an Admin to send the campaign to specific email addresses manually.

The UI should include:

```text
Email Address
[ example@email.com ]

[ + Add Another Email ]

Email Address
[ example2@email.com ]

[ + Add Another Email ]
```

Requirements:

* Admin can enter one email.
* Admin can add multiple email addresses.
* Validate email addresses.
* Prevent obvious duplicate email addresses.
* Allow removing an added email before sending.
* Show the final number of recipients.
* This must NOT automatically send to all subscribers.
* This must NOT automatically send to all customers.

The manually entered recipients are the only recipients for this action.

---

# CHANGE 3 — AUDIENCE SELECTION

When sending a campaign to stored audiences, provide audience checkboxes.

Example:

```text
Send Campaign To

☑ Subscribers

☐ Customers
```

Requirements:

### Subscribers

* Checked by default.
* Represents newsletter subscribers.

### Customers

* Optional.
* Represents eligible customer email recipients.

The Admin should be able to choose:

```text
☑ Subscribers
☐ Customers
```

Subscribers only.

Or:

```text
☐ Subscribers
☑ Customers
```

Customers only.

Or:

```text
☑ Subscribers
☑ Customers
```

Both groups.

---

# IMPORTANT — RECIPIENT DEDUPLICATION

If the same email address exists as both:

* a Subscriber
* and a Customer

the campaign must send only one email to that address.

Do not allow duplicate delivery to the same recipient.

The recipient list must be deduplicated before sending.

---

# IMPORTANT — CAMPAIGN RECIPIENT RULES

Clearly separate the two sending modes:

## Mode A — Send Audience

Uses:

* Subscribers
* Customers

according to selected checkboxes.

Example:

```text
Send Audience

☑ Subscribers
☑ Customers

[ Send ]
```

---

## Mode B — Send Specific

Uses only manually entered email addresses.

Example:

```text
Send Specific

email1@example.com
email2@example.com
email3@example.com

[ Send ]
```

This must not automatically include:

* all subscribers
* all customers

unless the Admin explicitly uses the Audience sending mode.

---

# IMPORTANT — SEND SAFETY

Before sending a campaign, display a clear confirmation summary.

Example:

```text
Campaign:
Summer Essence Collection

Recipients:
2 Subscribers
15 Customers

Total Unique Recipients:
16

[ Cancel ] [ Confirm & Send ]
```

For Send Specific:

```text
Campaign:
Summer Essence Collection

Specific Recipients:
3

Total Unique Recipients:
3

[ Cancel ] [ Confirm & Send ]
```

Do not accidentally send campaigns immediately without clear confirmation.

---

# CAMPAIGN HISTORY

Audit the existing campaign status system.

Preserve important states such as:

* Draft
* Sending
* Sent
* Failed

Do not allow editing campaign content after it has been sent if the existing architecture intentionally prevents this.

Preserve campaign history.

If recipient statistics already exist, preserve them.

---

# PHASE 5 — PROMOTIONS TERMINOLOGY FIX

Audit the Promotions area carefully.

There is currently incorrect campaign terminology inside the Promotions section.

---

## PROMOTIONS LIST

If the page is:

```text
Promotions
```

the primary creation button must be:

```text
+ New Promotion
```

NOT:

```text
+ New Campaign
```

---

## PROMOTION DETAILS

Inside Promotion details, audit all visible titles, labels, and actions.

Replace incorrect terminology.

For example:

Incorrect:

```text
Campaign
Create Campaign
Campaign Details
```

Correct terminology should use:

```text
Promotion
Create Promotion
Promotion Details
```

where the functionality is actually related to Promotions.

---

# IMPORTANT — DO NOT JUST REPLACE TEXT BLINDLY

Audit the actual feature relationship first.

Campaigns and Promotions are separate concepts.

For example:

```text
Promotion
=
An offer or marketing promotion.
```

Example:

* Seasonal promotion
* Homepage promotion
* Special offer

Whereas:

```text
Campaign
=
An email/marketing communication campaign.
```

Example:

* Email campaign
* Newsletter campaign
* Opening Day announcement

Do not mix these concepts in the UI.

Use the correct terminology consistently.

---

# PHASE 6 — DATABASE ARCHITECTURE

Before creating any new tables, audit the existing Supabase schema.

Determine:

* Existing tables that can be reused.
* Existing relationships.
* Existing content tables.
* Existing campaign tables.
* Existing subscriber tables.
* Existing customer tables.
* Existing promotion tables.
* Existing email recipient/history data.

---

# DO NOT DUPLICATE DATABASE STRUCTURE

The Admin UI structure does not need to match database tables one-to-one.

For example:

```text
Admin UI:

World of KHEM
→ Craftsmanship
→ Craft Pillars
→ Craft Figures
→ Perfumer's Quote
```

may internally use multiple Supabase tables.

This is acceptable.

The Admin user should see a logical content structure.

The database should remain normalized and technically correct.

---

# PHASE 7 — CONTENT AUDIT

Audit the entire public website.

Identify content that is:

### A. Hardcoded

Examples:

* Headings
* Paragraphs
* Quotes
* CTAs
* Images
* Captions
* Labels
* Cards
* Mission statements

### B. Stored in constants or JSON

Identify content stored in:

* TypeScript files
* JavaScript files
* JSON
* Static objects
* Component files

### C. Already stored in Supabase

Document:

* Table
* Columns
* Relationships
* Existing Admin management

---

# CMS DECISION RULE

For every content item ask:

> Will a KHEM team member reasonably need to change this in the future without a developer?

If yes, evaluate whether it belongs in the CMS.

Examples likely to be editable:

* Marketing text
* Headlines
* Descriptions
* Images
* Quotes
* Journal articles
* Ingredient information
* Landing page sections
* Page SEO
* Page banners

Do not move application logic into the CMS.

Do not make these CMS content:

* Authentication logic
* Cart logic
* Checkout logic
* Security logic
* Business calculations
* Application permissions
* Technical behavior

---

# PHASE 8 — ENGLISH AND ARABIC

The project supports:

```text
EN
AR
```

Audit all CMS content for localization.

The Admin experience should make it clear which language is being edited.

For example:

```text
English | Arabic
```

Verify:

* English content works.
* Arabic content works.
* Existing translations are preserved.
* No content is accidentally replaced with empty values.
* RTL remains correct.
* Locale routing remains correct.
* Localized SEO remains correct.

Do not introduce another translation system if the project already has one.

---

# PHASE 9 — SEO

Audit the existing SEO architecture.

Where appropriate, CMS pages should support editable:

* SEO title
* Meta description
* Open Graph title
* Open Graph description
* Open Graph image

Do not duplicate the existing SEO system.

Use the existing project architecture.

---

# PHASE 10 — SECURITY AND RLS

Audit:

* Supabase RLS
* Admin authorization
* User roles
* Public read permissions
* Admin write permissions
* Storage permissions
* Campaign sending authorization

Requirements:

* Public users can only access public content.
* Authorized Admin users can manage CMS content.
* Unauthorized users cannot modify CMS data.
* Campaign sending actions must be protected.
* Sensitive customer data must remain protected.

Do not weaken security policies just to make implementation easier.

---

# PHASE 11 — PRODUCTION DATABASE SAFETY

This is extremely important.

The KHEM production Supabase database will eventually contain real data.

Examples:

* Real products
* Real customers
* Real orders
* Real addresses
* Real discounts
* Real credits
* Credit transactions
* Real campaigns
* Real subscribers
* Real content
* Real journal articles

The current seed/demo data is cloned development data.

It is NOT the future real KHEM production catalog.

---

## NEVER DO THIS IN PRODUCTION

Never:

* Reset the production database.
* Truncate production tables.
* Drop production tables unnecessarily.
* Delete real production records to reorganize the Admin UI.
* Re-run destructive development seeds.
* Replace production data with seed data.
* Recreate records unnecessarily and change IDs.
* Use database reset commands against production.

---

# MIGRATIONS

Any database structural changes must use proper Supabase migrations.

The workflow should be:

```text
Change Required
      ↓
Inspect Existing Schema
      ↓
Create Safe Migration
      ↓
Test Locally
      ↓
Verify Existing Data
      ↓
Deploy Migration
```

Do not manually make undocumented structural changes that cannot be reproduced later.

---

# SEED SAFETY

Audit the existing seed implementation.

Clearly separate:

```text
Development Seed
```

from:

```text
Production Data
```

The production deployment process must not automatically run destructive seed operations.

Ideally, make the environment separation explicit and difficult to misuse.

A production deployment should use:

```text
Migrations
```

not destructive database reseeding.

---

# PHASE 12 — IMPLEMENTATION ORDER

Follow this order.

---

## STEP 1 — AUDIT

Do not modify immediately.

Audit:

* Admin Dashboard
* Sidebar
* Routes
* Database
* CMS
* Landing Page
* World of KHEM
* Campaigns
* Promotions
* Seeds
* Migrations
* Security

---

## STEP 2 — REPORT

Provide a concise implementation report before major changes.

Include:

### Current Structure

```text
Current Sidebar
Current Routes
Current CMS
Current Database
```

### Problems Found

Examples:

* Confusing sidebar structure.
* Duplicate navigation.
* Incorrect terminology.
* Hardcoded editable content.
* CMS content placed under the wrong section.
* Duplicate database structures.
* Unsafe seed behavior.

### Proposed Final Structure

Show the final sidebar tree.

### Database Impact

Clearly explain:

* Tables reused.
* Tables modified.
* New tables, if absolutely necessary.
* Migrations required.
* Existing data impact.

---

## STEP 3 — REORGANIZE NAVIGATION

Implement the new logical sidebar architecture.

Do not change functionality unnecessarily.

Preserve existing routes where possible.

If routes must change, handle redirects and references safely.

---

## STEP 4 — ORGANIZE CMS

Implement:

```text
Content
├── Landing Page
└── World of KHEM
    ├── Heritage
    ├── Craftsmanship
    ├── Ingredients
    ├── Journal
    └── About KHEM
```

Connect each section to its existing database source where possible.

Do not duplicate data.

---

## STEP 5 — FIX CAMPAIGNS

Implement:

* Send Subscribers
* Audience selection
* Subscribers checkbox
* Customers checkbox
* Subscriber selected by default
* Recipient deduplication
* Send Specific
* Multiple email inputs
* Email validation
* Confirmation before sending

Preserve existing campaign history.

---

## STEP 6 — FIX PROMOTIONS TERMINOLOGY

Audit all Promotion pages.

Ensure:

```text
Promotion ≠ Campaign
```

Use the correct terminology throughout the UI.

---

## STEP 7 — DATABASE CHANGES

Only create migrations when genuinely necessary.

Reuse existing tables whenever possible.

Verify:

* Relationships
* Foreign keys
* RLS
* Existing data
* IDs
* Localization

---

## STEP 8 — TEST EVERYTHING

Test:

### Admin Navigation

Every section should be accessible and logically organized.

### CMS

Change content and verify it appears on the correct public page.

### Landing Page

Verify every appropriate editable section.

### World of KHEM

Verify:

* Heritage
* Craftsmanship
* Ingredients
* Journal
* About KHEM

### Campaigns

Test:

* Subscribers only
* Customers only
* Both audiences
* Duplicate email between subscriber/customer
* Send Specific
* Multiple specific emails
* Invalid email
* Confirmation screen

### Promotions

Verify all terminology.

### Localization

Test EN and AR.

### Security

Test unauthorized access.

### Database

Verify no existing records were deleted or duplicated.

---

# PHASE 13 — FINAL DEPLOYMENT READINESS AUDIT

After implementation, perform a final complete audit.

Verify:

## Architecture

The Admin Dashboard is organized logically.

## Team Experience

A non-developer understands where to go.

## CMS

The team can control website content without editing code where appropriate.

## Database

Supabase remains the source of truth.

## Production Safety

No destructive seed/reset behavior can accidentally affect production.

## Performance

No unnecessary duplicate queries or database structures.

## Security

RLS and Admin permissions remain secure.

## Localization

EN and AR both work correctly.

## SEO

Existing SEO functionality remains intact.

---

# FINAL DELIVERABLE

At the end, provide a final summary containing:

## 1. Final Admin Sidebar

Show the completed structure.

## 2. CMS Architecture

Show:

```text
Content
→ Landing Page

Content
→ World of KHEM
→ Heritage
→ Craftsmanship
→ Ingredients
→ Journal
→ About KHEM
```

## 3. Database Changes

List:

* Reused tables.
* Modified tables.
* New migrations.
* New tables only if necessary.

## 4. Campaign Improvements

Confirm:

* Subscribers.
* Customers.
* Both audiences.
* Deduplication.
* Send Specific.
* Multiple email addresses.
* Confirmation.

## 5. Promotion Terminology

Confirm that Promotion and Campaign terminology are correctly separated.

## 6. Production Safety

Confirm:

* No destructive seed deployment.
* No production reset.
* Safe migrations.
* Existing data preserved.

---

# MOST IMPORTANT PRINCIPLE

The final KHEM Admin Dashboard should feel like a real internal control center.

The team should think:

```text
What do I want to do?
        ↓
Commerce?
Marketing?
Content?
Analytics?
System?
        ↓
Choose the relevant section
        ↓
Manage the content or data
```

For website content:

```text
What website page do I want to edit?
        ↓
Landing Page
OR
World of KHEM
        ↓
Choose the page
        ↓
Choose the section
        ↓
Edit → Save → Live
```

The database should remain technically organized underneath this interface.

The Admin Dashboard should be organized for humans.

Supabase should be organized for data integrity.

Do not sacrifice real data, existing records, security, or production safety simply to reorganize the interface.
