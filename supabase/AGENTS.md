You are the Senior Full-Stack Engineer for the KHEM luxury perfume ecommerce application.

IMPORTANT:
- Read the existing root AGENTS.md before doing anything.
- The project uses Next.js + React + TypeScript + Tailwind CSS.
- Authentication: Clerk.
- Database: Supabase PostgreSQL.
- Database access: Supabase client directly.
- DO NOT use Prisma.
- DO NOT install Prisma.
- DO NOT create schema.prisma.
- DO NOT create Prisma migrations.
- Supabase SQL migrations are the database source of truth.

Your task is to build the complete KHEM ADMIN DASHBOARD and connect it to the Supabase database.

==================================================
1. FIRST INSPECT THE PROJECT
==================================================

Before writing code:

1. Read AGENTS.md.
2. Inspect the complete existing project structure.
3. Inspect package.json.
4. Inspect the existing Supabase configuration.
5. Inspect existing Supabase types.
6. Inspect existing SQL migrations/tables if available.
7. Inspect Clerk configuration.
8. Inspect existing dashboard-related components/routes.
9. Reuse existing components, styles, utilities and architecture where possible.
10. Do not rewrite unrelated parts of the application.

If the required database tables do not exist yet, create proper Supabase SQL migrations.

Do NOT create fake local JSON data as a replacement for the database.

==================================================
2. ADMIN DASHBOARD ROUTE
==================================================

Create/properly implement:

/admin

The admin must be protected.

Only authorized KHEM admin users can access it.

Use Clerk for authentication and authorization.

A normal customer must NOT be able to access admin functionality.

Do not rely only on hiding UI elements.

Authorization must be enforced server-side.

==================================================
3. DASHBOARD STRUCTURE
==================================================

Create:

Dashboard
├── Overview
├── Orders
├── Customers
├── Products
├── Collections
├── Inventory
├── Discovery Credits
├── Discounts
├── Newsletter
├── Journal
├── Content
├── Stockists
└── Settings

Use a premium KHEM visual style consistent with the existing application.

The dashboard should feel like a luxury brand management system, not a generic admin template.

==================================================
4. OVERVIEW
==================================================

Create a dashboard overview showing:

- Total sales
- Orders
- Customers
- Products
- Low-stock products
- Pending orders
- Discovery credits issued
- Discovery credits redeemed
- Newsletter subscribers

Add useful date filters:

- Today
- 7 days
- 30 days
- 90 days
- Custom range

Use Supabase queries to calculate real values.

Do not use fake statistics.

If there is no data, show proper empty states.

==================================================
5. ORDERS
==================================================

Create:

/admin/orders

Features:

- Order list
- Search
- Filter
- Pagination
- Order status
- Payment status
- Customer
- Total
- Date

Order detail page:

/admin/orders/[id]

Show:

- Order number
- Customer
- Customer email
- Items
- Product
- Variant
- Quantity
- Unit price
- Discount
- Shipping
- Tax
- Total
- Payment status
- Order status
- Shipping address
- Billing address
- Created date

Allow admin to update appropriate order statuses.

Order status examples:

pending
confirmed
processing
shipped
delivered
cancelled
refunded

Never allow the client to directly modify sensitive financial values.

==================================================
6. CUSTOMERS
==================================================

Create:

/admin/customers

Show:

- Customer name
- Email
- Phone
- Registration date
- Number of orders
- Total spending
- Available discovery credit

Customer detail:

/admin/customers/[id]

Show:

- Profile
- Email
- Orders
- Discovery credits
- Credit transactions
- Subscription/newsletter status

Authentication identity remains with Clerk.

Supabase should store application/customer information and the Clerk user ID.

Do not store passwords.

==================================================
7. PRODUCTS
==================================================

Create:

/admin/products

Features:

- List products
- Search
- Filter by collection
- Filter by status
- Create product
- Edit product
- Archive product

Product editor must support:

- Name
- Slug
- Description
- Story
- Collection
- Category
- Gender
- Featured
- New
- Bestseller
- SEO
- Product images
- Fragrance notes
- Ingredients
- Variants

Variants must support:

- Size
- SKU
- Price
- Compare price
- Availability
- Inventory

Do not store product images as database binaries.

Use the project's existing media/Cloudinary architecture.

==================================================
8. COLLECTIONS
==================================================

Create:

/admin/collections

Allow:

- Create collection
- Edit collection
- Archive collection
- Manage collection products
- Change ordering
- Manage hero/banner images
- Manage SEO

Initial KHEM collections include:

- Signature Collection
- KHEM NOIR Collection

The architecture must support future collections.

==================================================
9. INVENTORY
==================================================

Create:

/admin/inventory

Show:

- Product
- Variant
- SKU
- Current quantity
- Low stock threshold
- Status

Support:

- Restock
- Manual adjustment
- Damaged stock
- Returned stock

Every inventory change must create an inventory movement.

Never simply overwrite inventory without recording the reason.

==================================================
10. DISCOVERY CREDIT SYSTEM
==================================================

This is a critical KHEM feature.

Create/use:

customer_credits
credit_transactions

Do NOT simply store one editable "balance" field.

The system must use a transaction/ledger approach.

Credit transaction types:

earned
used
expired
refunded
adjusted

Example:

Customer purchases Discovery Set
        ↓
Payment confirmed
        ↓
Create credit transaction: EARNED
        ↓
Customer receives credit
        ↓
Customer purchases qualifying full-size perfume
        ↓
Create credit transaction: USED

Available balance should be calculated from the transaction ledger.

The system must prevent:

- Double redemption
- Negative balance
- Reusing the same discovery credit
- Client-side manipulation

Credits should be tied to the qualifying discovery product/collection where appropriate.

Admin dashboard must allow viewing:

- Customer
- Credit amount
- Source order
- Status
- Created date
- Expiration date
- Used date
- Related redemption order

==================================================
11. FIRST SUBSCRIPTION 10% DISCOUNT
==================================================

Create a newsletter/subscription system.

When a user subscribes for the first time:

1. Validate email.
2. Check whether the email has already received the first-subscription offer.
3. Create/register the subscriber.
4. Generate or assign a unique 10% discount.
5. Mark the offer as issued.
6. Send the discount email.
7. Prevent the same user from repeatedly receiving the offer.

The discount must be server-controlled.

Never trust a discount percentage sent from the browser.

Create appropriate database structures for:

newsletter_subscribers
discounts
customer_discount/redemption tracking if required

The dashboard must allow admins to see:

- Subscribers
- Subscription date
- Status
- First-offer status
- Discount code
- Redemption status

==================================================
12. DISCOUNTS
==================================================

Create:

/admin/discounts

Allow admin to:

- Create discount
- Edit discount
- Activate/deactivate
- Set percentage
- Set fixed amount
- Set start date
- Set expiry date
- Set usage limit
- Set minimum order
- Restrict to products
- Restrict to collections

Show:

- Usage
- Remaining usage
- Revenue generated if practical

Never calculate final order prices on the client.

==================================================
13. NEWSLETTER / MARKETING
==================================================

Create:

/admin/newsletter

Show:

- Subscriber count
- Active subscribers
- Unsubscribed
- Subscription date

Prepare the dashboard for marketing campaigns.

Do not build a complicated email marketing platform unless existing requirements demand it.

Use the configured email provider/API for sending.

Do not send bulk marketing emails directly from a normal Next.js request if the provider requires asynchronous processing.

All marketing emails must respect unsubscribe status and consent.

==================================================
14. JOURNAL
==================================================

Create:

/admin/journal

Support:

- Create post
- Edit post
- Draft
- Publish
- Archive
- Categories
- Tags
- Cover image
- SEO

Use the existing KHEM visual language.

==================================================
15. CONTENT / CMS
==================================================

Create management interfaces for:

- Homepage sections
- Heritage
- Craftsmanship
- About
- Ingredients
- Other editable pages

The CMS must use reusable section types rather than creating a different database table for every visual section.

Support:

- Create
- Edit
- Delete/archive
- Reorder
- Publish/unpublish

==================================================
16. STOCKISTS
==================================================

Create:

/admin/stockists

Allow:

- Add stockist
- Edit stockist
- Activate/deactivate
- Country
- City
- Address
- Website
- Phone
- Email
- Coordinates

==================================================
17. SETTINGS
==================================================

Create:

/admin/settings

Organize settings into:

General
Store
Currency
Markets
Shipping
SEO
Social Media
Email
Newsletter

Do not expose secret API keys in the UI.

==================================================
18. SUPABASE ARCHITECTURE
==================================================

Use Supabase directly.

Preferred architecture:

Next.js
↓
Server Components / Server Actions / Route Handlers
↓
Supabase
↓
PostgreSQL

Use the appropriate Supabase client for:

- Server
- Browser
- Middleware where required

Do not expose service-role credentials to the browser.

Use environment variables.

==================================================
19. DATABASE SECURITY
==================================================

Implement proper Supabase Row Level Security where appropriate.

Public users should only be able to read data that is explicitly intended to be public.

Customers must only access their own:

- Profile
- Cart
- Orders
- Credits

Admins can access authorized dashboard data.

Never use unrestricted policies such as:

USING (true)

for sensitive tables.

Never rely only on frontend route protection.

==================================================
20. SERVER-SIDE BUSINESS LOGIC
==================================================

Critical operations must happen server-side:

- Order creation
- Price calculation
- Discount validation
- Discovery credit issuance
- Discovery credit redemption
- Inventory changes
- Payment confirmation
- Customer authorization

Never trust:

- price
- total
- discount amount
- credit amount
- inventory quantity
- customer ID

sent from the client.

==================================================
21. STRIPE
==================================================

If Stripe is already configured:

Use Stripe webhooks as the trusted source for payment confirmation.

Do not issue:

- orders
- inventory reductions
- discovery credits

solely because the frontend says payment succeeded.

The trusted flow is:

Stripe
↓
Webhook
↓
Server validation
↓
Supabase transaction/update
↓
Order confirmed

==================================================
22. UI / UX
==================================================

The dashboard must follow the KHEM brand:

- Ultra-luxury
- Minimal
- Editorial
- Premium
- Elegant
- Dark luxury aesthetic
- Excellent typography
- Subtle animations
- High-quality spacing
- Responsive

Do not create a generic SaaS-looking dashboard.

Use the existing KHEM colors and fonts from AGENTS.md.

Support desktop and tablet properly.

Mobile dashboard should remain usable.

==================================================
23. DATA FETCHING
==================================================

Use efficient Supabase queries.

Avoid:

- N+1 queries
- fetching entire tables unnecessarily
- client-side filtering of large datasets

Use:

- pagination
- server-side filtering
- server-side sorting
- indexed queries

==================================================
24. VALIDATION
==================================================

Use Zod or the project's existing validation system.

Validate:

- forms
- products
- variants
- discounts
- orders
- customer input
- newsletter subscriptions
- credits

Return proper errors.

Never expose internal database errors directly to users.

==================================================
25. AUDITABILITY
==================================================

For important business operations, preserve useful history.

Especially:

- Inventory changes
- Credit changes
- Discount redemption
- Order status changes
- Payment events

Do not silently modify financial/business records.

==================================================
26. IMPLEMENTATION RULE
==================================================

Do not build everything in one huge uncontrolled change.

Work in phases:

PHASE 1
Database inspection + missing SQL migrations

PHASE 2
Dashboard layout + authentication/authorization

PHASE 3
Overview + Orders

PHASE 4
Customers

PHASE 5
Products + Collections

PHASE 6
Inventory

PHASE 7
Discovery Credits

PHASE 8
Discounts + First Subscription Offer

PHASE 9
Newsletter

PHASE 10
Journal + CMS

PHASE 11
Stockists + Settings

PHASE 12
Security + performance + testing

After each phase:

- Typecheck
- Lint
- Validate Supabase queries
- Check authorization
- Check responsive UI
- Do not break existing customer-facing pages

==================================================
27. IMPORTANT
==================================================

Do not use Prisma.

Do not create Prisma files.

Do not install Prisma.

Do not replace Supabase with another database.

Do not invent KHEM products or business data.

Do not use mock data once the relevant Supabase tables exist.

Do not modify unrelated frontend pages.

Do not expose secrets.

Do not implement financial logic only on the client.

Before making major architectural changes, explain what you are changing and why.

Start with PHASE 1.

Inspect the existing project and database setup first.

Then report:

1. What already exists.
2. What is missing.
3. Which Supabase tables/migrations are required.
4. Any conflicts with the existing AGENTS.md.
5. Your proposed implementation order.

Do NOT start changing unrelated code until this inspection is complete.