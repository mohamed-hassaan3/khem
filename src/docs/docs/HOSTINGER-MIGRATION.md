# KHEM — Vercel to Hostinger Migration Plan

## Purpose

Safely migrate the KHEM Next.js application from Vercel to Hostinger without breaking:

* Next.js functionality
* Clerk authentication
* Clerk webhooks
* Supabase
* Database functionality
* Admin dashboard
* API routes
* Product and collection pages
* SEO
* Google indexing
* Domain configuration
* Environment variables
* Caching and ISR
* Images and assets
* Arabic and English routes
* Performance

The current production deployment is on Vercel.

The goal is to move the application to Hostinger with **minimal or zero downtime**.

---

# CRITICAL RULES

## 1. Inspect before changing

Do NOT immediately modify deployment configuration.

First inspect the existing codebase and identify:

* Next.js version
* Node.js version
* Package manager
* `package.json`
* `next.config.*`
* Environment variables
* Vercel-specific configuration
* Build command
* Start command
* ISR configuration
* API routes
* Middleware
* Clerk integration
* Supabase integration
* Webhooks
* Image configuration
* Domain configuration
* SEO files

Do not assume that Vercel behavior will work identically on Hostinger.

---

## 2. Do not migrate the production domain immediately

The migration must follow this order:

```text
Current Production
Vercel
      ↓
Prepare Hostinger
      ↓
Deploy and test Hostinger version
      ↓
Verify all functionality
      ↓
Prepare domain configuration
      ↓
Switch production domain
      ↓
Verify production
      ↓
Keep rollback option temporarily
```

Do not point the main production domain to Hostinger until testing is complete.

---

# PHASE 1 — CURRENT DEPLOYMENT AUDIT

Inspect the current application for anything dependent on Vercel.

Search for:

```text
vercel
VERCEL
@vercel
vercel.json
VERCEL_URL
```

Also inspect for:

* Vercel Cron
* Vercel Blob
* Vercel Edge Runtime
* Vercel-specific environment variables
* Vercel Analytics
* Vercel deployment URLs
* Vercel-specific middleware behavior

Create a report:

```text
Feature:
Current implementation:
Vercel dependency:
Migration risk:
Hostinger compatibility:
Recommended action:
```

Do not remove anything before confirming whether it is required.

---

# PHASE 2 — HOSTINGER COMPATIBILITY

Determine whether the current KHEM application can run correctly on the available Hostinger plan.

Verify compatibility with:

```text
Next.js
Node.js
React
TypeScript
SSR
Server Components
Route Handlers
API Routes
Server Actions
Middleware
Dynamic Routes
ISR
Image Optimization
```

Identify anything that requires:

* Configuration changes
* A different Node.js version
* A different deployment strategy
* A different caching strategy

Do not guess.

Use the actual application configuration and current Hostinger capabilities.

---

# PHASE 3 — BUILD CONFIGURATION

Verify the production commands.

Inspect:

```text
package.json
```

Determine the correct commands for:

```text
Install
Build
Production Start
```

Example concept:

```text
npm install
npm run build
npm run start
```

Do not modify scripts unless necessary.

Verify the application builds successfully before migration.

---

# PHASE 4 — NODE.JS VERSION

Determine the currently required Node.js version.

Inspect:

```text
package.json
engines
.nvmrc
deployment configuration
```

Ensure the Hostinger environment uses a compatible version.

Do not upgrade or downgrade Node.js unnecessarily during migration.

Changing Node.js versions can introduce unrelated production bugs.

---

# PHASE 5 — ENVIRONMENT VARIABLES

Create a complete environment variable migration checklist.

Identify all variables used by the application.

Examples may include:

```text
NEXT_PUBLIC_*
CLERK_*
SUPABASE_*
DATABASE_*
SITE_URL
APP_URL
WEBHOOK_*
```

Classify each variable:

```text
Variable:
Purpose:
Client-safe:
Server-only:
Development value:
Production value:
Required on Hostinger:
```

Critical rules:

* Never expose server secrets.
* Never expose service-role keys.
* Never commit `.env` files.
* Do not use localhost values in production.
* Do not use temporary ngrok URLs in production.
* Do not accidentally use Vercel preview URLs as canonical URLs.

Create or maintain:

```text
.env.example
```

Do not include real secrets.

---

# PHASE 6 — CLERK MIGRATION

Audit the Clerk integration.

Verify:

* Clerk publishable key
* Clerk secret key
* Middleware
* Protected routes
* Admin authorization
* Sign-in URLs
* Sign-up URLs
* Redirect URLs
* Production domain configuration

Important:

The production domain may change infrastructure, but the public domain may remain the same.

Do not unnecessarily change Clerk configuration if the public production domain remains:

```text
https://khemperfumes.com
```

After Hostinger testing is ready, verify Clerk authentication on the Hostinger deployment.

Test:

```text
Sign up
Sign in
Sign out
Session persistence
Protected pages
Admin access
Unauthorized access
```

---

# PHASE 7 — CLERK WEBHOOK MIGRATION

Identify all Clerk webhook endpoints.

Example:

```text
/api/webhooks/clerk
```

Verify:

* Correct endpoint path
* Webhook signature verification
* Webhook secret
* Production URL

Before switching production:

```text
Vercel webhook
        ↓
Hostinger testing endpoint
        ↓
Verify delivery
        ↓
Verify Supabase synchronization
```

After verification, update the production webhook endpoint only when appropriate.

Test:

```text
User created
User updated
User deleted
Other required events
```

Ensure webhook events do not accidentally create duplicate records during migration.

---

# PHASE 8 — SUPABASE MIGRATION

The database remains in Supabase.

Do NOT migrate the database unless explicitly required.

Verify the Hostinger deployment can connect correctly to:

* Supabase project
* Supabase Auth if used
* Supabase database
* Supabase storage

Check:

```text
Environment variables
Server-side connections
Client-side connections
RLS
Service-role usage
```

Critical rule:

```text
SUPABASE_SERVICE_ROLE_KEY
```

must remain server-only.

Test:

* Product fetching
* Collections
* Customers
* Orders
* Discounts
* Credits
* Addresses
* Admin operations

Do not expose private customer data through caching.

---

# PHASE 9 — ISR AND CACHING

This is a critical migration area.

The current Vercel deployment has shown high ISR usage.

Do not assume that caching works identically on Hostinger.

Inspect:

```text
revalidate
revalidatePath
revalidateTag
unstable_cache
fetch cache
dynamic
force-dynamic
force-static
```

For each public route, identify:

```text
Route:
Rendering strategy:
Static / Dynamic / ISR:
Cache behavior:
Revalidation trigger:
Hostinger compatibility:
```

---

## Required caching strategy

### Public content

Examples:

```text
/
 /products/[slug]
 /collections/[slug]
```

Use efficient caching where supported.

Avoid:

* Regenerating content for every visitor
* Extremely short revalidation periods
* Invalidating the entire site for one small content update

---

### User-specific pages

Examples:

```text
/account
/orders
/cart
/checkout
```

Must remain private and dynamic.

Never cache one user's data and expose it to another user.

---

### Admin pages

Examples:

```text
/admin
```

Admin data should remain secure and fresh.

Do not use public ISR caching for private admin content.

---

## On-demand revalidation

If content changes through the admin dashboard:

```text
Admin updates product
        ↓
Database updates
        ↓
Only required public pages are invalidated
```

Do not invalidate unrelated pages.

---

# PHASE 10 — NEXT.JS IMAGE OPTIMIZATION

Inspect:

```text
next.config.*
```

Check:

```text
images.remotePatterns
images.domains
```

Verify all image sources continue working.

Possible sources:

* Supabase Storage
* Cloudinary
* Other external sources

Test:

* Homepage images
* Product images
* Collection images
* Mobile images

Do not break image optimization during migration.

---

# PHASE 11 — API ROUTES AND SERVER ACTIONS

Test every critical backend operation.

Check:

```text
/api/*
```

and all server actions.

Test:

* Authentication
* Product operations
* Customer operations
* Discounts
* Credits
* Orders
* Webhooks

Verify:

* Correct request handling
* Authentication
* Authorization
* Environment variables
* Error handling

---

# PHASE 12 — DOMAIN MIGRATION

The production domain should not be moved until Hostinger deployment passes testing.

Current concept:

```text
khemperfumes.com
        ↓
Vercel
```

Target:

```text
khemperfumes.com
        ↓
Hostinger
```

Before changing DNS:

1. Record the current DNS configuration.
2. Document existing records.
3. Identify email-related DNS records.
4. Do not accidentally delete MX records.
5. Preserve email configuration.
6. Preserve SPF records.
7. Preserve DKIM records.
8. Preserve DMARC records if configured.

Critical:

Do not change unrelated DNS records.

Only update the records required for website hosting.

---

# PHASE 13 — SEO PROTECTION DURING MIGRATION

The production domain should remain consistent whenever possible.

If the domain remains:

```text
https://khemperfumes.com
```

the infrastructure migration should not require URL changes.

Verify after migration:

```text
https://khemperfumes.com/robots.txt
https://khemperfumes.com/sitemap.xml
```

Check:

* Pages remain publicly accessible
* No accidental `noindex`
* Canonical URLs remain correct
* Sitemap URLs use production URLs
* Robots rules remain correct
* Metadata remains unchanged
* Structured data remains valid

Do not allow temporary Hostinger URLs to become canonical production URLs.

---

# PHASE 14 — REDIRECTS

Inspect existing redirects.

Verify:

* HTTP → HTTPS
* www → non-www or non-www → www consistency
* Old URLs continue working
* No redirect loops
* No unnecessary redirect chains

If Vercel-specific redirects exist, identify how they will be handled on Hostinger.

Do not remove existing redirects without replacing them.

---

# PHASE 15 — SECURITY AFTER MIGRATION

Verify after deployment:

```text
HTTPS works
Secrets are protected
Admin routes are protected
API routes are protected
Webhook verification works
Security headers still work
No production debug information is exposed
```

Check that the migration does not accidentally expose:

* Environment variables
* Stack traces
* Database errors
* Secrets
* Service keys

---

# PHASE 16 — PERFORMANCE TESTING

Compare:

```text
Vercel production
vs
Hostinger staging/testing deployment
```

Evaluate:

* Page loading
* TTFB
* Images
* JavaScript
* Product pages
* Collection pages
* Mobile performance
* Core Web Vitals

Do not migrate if the new deployment introduces major performance regressions without understanding why.

---

# PHASE 17 — PRE-DOMAIN-SWITCH TEST

Before changing the production domain, test the Hostinger deployment completely.

## Public website

```text
[ ] Homepage
[ ] Navigation
[ ] Collections
[ ] Product pages
[ ] Product images
[ ] Arabic
[ ] English
[ ] Mobile
```

## Authentication

```text
[ ] Sign up
[ ] Sign in
[ ] Sign out
[ ] Account access
[ ] Admin access
```

## Database

```text
[ ] Products
[ ] Collections
[ ] Customers
[ ] Orders
[ ] Discounts
[ ] Credits
```

## Technical

```text
[ ] Production build
[ ] API routes
[ ] Server actions
[ ] Images
[ ] Caching
[ ] ISR behavior
[ ] Error pages
```

---

# PHASE 18 — DOMAIN SWITCH

Only proceed after all tests pass.

During domain migration:

```text
1. Update only required DNS records.
2. Keep email DNS records unchanged.
3. Wait for DNS propagation.
4. Verify HTTPS.
5. Test production immediately.
```

After switching:

Test:

```text
Homepage
Products
Collections
Authentication
Admin
Supabase
Clerk
Webhooks
Checkout
Arabic
English
robots.txt
sitemap.xml
```

---

# PHASE 19 — POST-MIGRATION MONITORING

After migration, monitor for:

* 404 errors
* 500 errors
* Authentication failures
* Webhook failures
* Supabase failures
* Broken images
* Slow responses
* SEO crawling problems

Do not immediately delete or completely dismantle the previous deployment.

Keep Vercel available temporarily as a rollback option.

---

# PHASE 20 — ROLLBACK PLAN

Before switching DNS, document how to revert.

Example:

```text
Problem detected
        ↓
Restore previous DNS configuration
        ↓
Return traffic to Vercel
        ↓
Investigate Hostinger issue
```

The rollback plan must be documented before the production switch.

---

# REQUIRED FINAL REPORT

After completing the migration preparation, provide:

## 1. Migration Readiness

```text
Ready
or
Not Ready
```

Explain why.

---

## 2. Vercel Dependencies

List every dependency found.

```text
Dependency:
Location:
Risk:
Required action:
```

---

## 3. Hostinger Compatibility

```text
Compatible:
Configuration required:
Potential limitations:
```

---

## 4. Environment Variables

List:

```text
Required variables
Variables that need new production values
Variables that should remain unchanged
```

Never print secret values.

---

## 5. Clerk Checklist

Report:

```text
Authentication:
Webhooks:
Redirect URLs:
Production domain:
Status:
```

---

## 6. Supabase Checklist

Report:

```text
Database:
RLS:
Server access:
Client access:
Status:
```

---

## 7. Caching and ISR Report

Explain:

```text
Current caching strategy
Problems found
Changes required
Hostinger behavior considerations
Recommended strategy
```

Do not claim Hostinger will behave exactly like Vercel without verification.

---

## 8. SEO Migration Report

Confirm:

```text
robots.txt
sitemap.xml
canonical URLs
metadata
structured data
redirects
```

---

## 9. DNS Changes Required

Clearly separate:

### Must change

### Must NOT change

Especially protect:

```text
MX
SPF
DKIM
DMARC
Email records
```

---

## 10. Final Migration Steps

Provide the exact order:

```text
STEP 1
Prepare Hostinger deployment

STEP 2
Configure environment variables

STEP 3
Deploy application

STEP 4
Test all functionality

STEP 5
Test Clerk

STEP 6
Test Supabase

STEP 7
Test webhooks

STEP 8
Test caching

STEP 9
Verify SEO

STEP 10
Document DNS

STEP 11
Prepare rollback

STEP 12
Switch domain

STEP 13
Verify production

STEP 14
Monitor
```

---

# FINAL RULE

Do not make unnecessary changes to the KHEM application simply because the hosting provider is changing.

The preferred approach is:

```text
Understand current architecture
        ↓
Identify Vercel-specific dependencies
        ↓
Prepare Hostinger compatibility
        ↓
Deploy safely
        ↓
Test completely
        ↓
Switch domain only after verification
```

The migration must prioritize:

```text
NO DATA LOSS
+
NO SECURITY REGRESSION
+
MINIMAL DOWNTIME
+
NO SEO DAMAGE
+
NO BROKEN AUTHENTICATION
+
NO BROKEN WEBHOOKS
+
STABLE PERFORMANCE
```
