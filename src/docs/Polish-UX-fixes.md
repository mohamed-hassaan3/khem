# Small Project Polish & UX Fixes

## Important Instructions

This is a **targeted polish task**, not a redesign or refactor.

Before making changes:

* Read the existing `AGENTS.md` and all relevant UI/design documentation.
* Inspect the current implementation before changing anything.
* Reuse existing components, patterns,  visual color/gradient fading, and styling.
* Do not redesign unrelated areas.
* Do not change database structure unless absolutely necessary.
* Do not break existing functionality, SEO, responsive behavior, authentication, or admin features.
* Keep all changes minimal, clean, and production-safe.

---

## 1. Customize Clerk Sign In / Sign Up

Pages:

* `/signin`
* `/signup`

The current Clerk authentication UI still looks too generic.

Customize the Clerk appearance to match the **KHEM luxury identity**.

Requirements:

* Use the existing `logo-transparent` asset from the `/public` directory.
* Maintain the existing KHEM light-first luxury design system.
* Make the authentication card feel premium, elegant, minimal, and consistent with the website.
* Customize colors, borders, spacing, buttons, inputs, typography, and card styling where Clerk allows it.
* Keep all Clerk authentication functionality working correctly.
* Do not attempt unsupported Clerk modifications or fragile CSS hacks.

---

## 2. Footer Collections Organization on Desktop

Only modify the **Collections section inside the footer**.

### Desktop

The collections list is currently too long and unorganized.

Make the Collections section behave similarly to the navigation organization:

* Group or collapse the fragrance collections cleanly.
* Keep the structure visually organized.
* Make it easier to scan.
* Do not change the rest of the footer.
* Do not redesign other footer sections.

### Mobile

The current mobile behavior is already good.

**Do not change the mobile footer behavior.**

This task applies only to the collections content and its organization.

---

## 3. Fix Admin Analytics Data Display

Currently, Analytics in the admin does not properly display:

* Days
* Dates
* Numbers/data values

Audit the complete analytics data flow:

* Database/query layer
* API/server logic
* Date generation
* Time zones if relevant
* Client-side transformation
* Chart/table rendering

Find the actual cause and fix it.

Requirements:

* Ensure days/dates appear correctly.
* Ensure analytics numbers appear correctly.
* Handle empty states correctly.
* Do not insert fake or hardcoded analytics data.
* Do not break existing analytics calculations.

---

## 4. Make Password Requirements Less Strict

Improve signup/password UX by making the password policy less strict where safely possible.

Requirements:

* First inspect the current password policy and determine whether it is controlled by Clerk or project-side validation.
* Reduce unnecessary complexity requirements while maintaining reasonable account security.
* Keep validation consistent between frontend and authentication provider.
* Do not create conflicting password rules where the UI accepts a password that Clerk rejects.

If the policy is controlled by Clerk Dashboard configuration and cannot be safely changed in code, clearly document that instead of implementing a fake frontend-only solution.

---

## 5. Add Gemstone Collection to Landing Page Collections

On the landing page, there is a collections section directly below the HERO.

Currently, it represents only:

* Signature
* Noir

Add:

* Gemstone

So the section includes all three relevant collections.

Requirements:

* Reuse the existing collection card design.
* Maintain the current responsive layout and visual hierarchy.
* Use the existing Gemstone collection content/assets where available.
* Do not create duplicate or inconsistent collection data.
* Update the heading/title above the cards because the current wording refers to only two collections.

The new title should naturally represent all collections without explicitly suggesting there are only two.

---

## 6. Standardize HERO Banner Entrance Effects Across All Pages

Audit **all pages containing a HERO/banner section**.

Currently, some pages have inconsistent  visual color/gradient fading.

The issue is the visual color/gradient fading effect between the banner image and the page background.

I noticed examples such as:

* Body Care
* Gift Set
* Other similar pages

The desired reference behavior is the existing effect used on pages such as:

* Collections
* Noir
* Gemstone
* Scent Profile

### Required Behavior

Standardize the HERO  visual color/gradient fading so that:

* The visual effect enters/reveals from **bottom to top**.
* The  visual color/gradient fading behavior is consistent across all HERO banners.
* The title is included in the  visual color/gradient fading.
* The description is included in the  visual color/gradient fading.
* Any related CTA/button content should follow the existing intended  visual color/gradient fading pattern where applicable.

Important:

* Reuse the existing working  visual color/gradient fading implementation from the correct reference pages instead of creating multiple new  visual color/gradient fading systems.
* Preserve each page's existing layout and content.
* Do not make all HERO sections identical if their structure is intentionally different.
* Only standardize the entrance/reveal effect and timing behavior where appropriate.
* Check desktop and mobile.

---

# Final Audit

After completing all six tasks:

1. Test desktop and mobile layouts.
2. Test `/signin` and `/signup`.
3. Verify Clerk authentication still works.
4. Verify the footer changes affect only the intended Collections section.
5. Verify analytics displays real dates/days and values.
6. Verify password validation matches the actual authentication provider.
7. Verify the landing page shows Signature, Noir, and Gemstone correctly.
8. Audit every HERO/banner page for  visual color/gradient fading consistency.
9. Check for console errors and TypeScript/build errors.
10. Do not introduce unrelated visual changes.

## Final Response

Provide a concise summary containing:

* What was changed
* Which pages/components were affected
* Root cause of the analytics issue
* How the password policy was handled
* Any limitation caused by Clerk configuration
* Confirmation that no unrelated areas were intentionally changed





