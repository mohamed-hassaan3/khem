# KHEM — Temporary Pre-Launch Cover

## Objective

Create a **temporary, isolated Coming Soon experience** that visually covers the existing KHEM website before the official product launch.

The purpose is to make KHEM feel like a luxury house that is intentionally not open for shopping yet.

The public experience should be:

> **KHEM**
> **ESSENCE OF HERITAGE**
> **COMING SOON**

with the existing KHEM cinematic video playing as the main visual background.

The visitor should be able to enter:

> **WORLD OF KHEM**

and explore the existing editorial/content experience.

### Critical principle

**Do NOT redesign, modify, break, duplicate, or replace the existing KHEM website.**

The pre-launch experience must behave as a temporary presentation layer that can be completely disabled/removed when KHEM launches.

---

# 1. Existing Video

Use this exact Cloudinary video:

https://res.cloudinary.com/co1xzkhf/video/upload/KHEM-ESSENCE-indoor.mp4

Do not generate a new video.

Do not download/re-encode it unless technically required.

Do not modify the existing Cloudinary asset.

The video is the main visual background of the pre-launch cover.

---

# 2. Visual Direction

The experience must match the existing KHEM brand direction:

* Luxury
* Egyptian heritage
* Ivory
* Warm sand
* Champagne / antique gold
* Refined charcoal shadows
* Cinematic
* Minimal
* Mysterious
* Elegant
* Premium
* Editorial
* Sophisticated

Avoid:

* Generic "Coming Soon" templates
* Startup-style layouts
* Bright white UI
* Excessive animations
* Cheap gold gradients
* Excessive Egyptian symbols
* Tourist-style Egyptian imagery
* Product grids
* Fake products
* Ecommerce UI
* Heavy text
* Visual clutter

The visitor should feel:

> "Something important is being revealed."

Not:

> "This website is under construction."

---

# 3. Fullscreen Cover

Create a fullscreen responsive cover.

Desktop:

* 100vw
* 100vh
* video fills viewport
* cinematic cropping
* no horizontal overflow
* no visible page underneath

Mobile:

* 100vw
* 100svh / appropriate mobile viewport handling
* video remains visually strong
* content remains readable
* no layout jumps
* no horizontal scrolling

The video should use:

```tsx
autoPlay
muted
loop
playsInline
```

Do not depend on audio autoplay.

The experience must work silently.

---

# 4. Layer Structure

Recommended structure:

```text
PrelaunchCover
├── Video background
├── Cinematic overlay
├── Brand/logo layer
├── Coming Soon message
├── World of KHEM CTA
├── Join KHEM CTA
└── Minimal navigation
```

The video must remain visually dominant.

Use subtle overlays where necessary to guarantee readability.

Do not hide the entire video behind an opaque overlay.

---

# 5. Brand Presentation

Use the existing KHEM logo asset from the project.

Do NOT recreate the logo using text.

Do NOT ask the video to generate the logo.

Do NOT generate the logo through CSS.

Use the real KHEM brand asset.

Primary visual hierarchy:

```text
KHEM

ESSENCE OF HERITAGE

COMING SOON
```

Keep the typography elegant and restrained.

Do not introduce new fonts unless the existing KHEM design system requires it.

Reuse existing project typography/design tokens wherever possible.

---

# 6. Main CTA

The primary CTA should be:

> WORLD OF KHEM

This should feel like entering a luxury editorial world, not navigating a normal website.

Interaction:

* subtle gold/ivory hover
* elegant underline or minimal directional indicator
* smooth transition
* no oversized button
* no pill-shaped startup UI

Clicking it should open the World of KHEM menu, which includes:

```text
Our Heritage
Craftsmanship
Ingredients (delete the perfumes links)
Journal
About KHEM
```

or the actual existing World of KHEM route if its current route differs.

**Do not create a duplicate World of KHEM page.**

Use the existing implementation.

---

# 7. Email / Inner Circle

The pre-launch cover should also provide:

> JOIN THE INNER CIRCLE

This should connect to the **existing subscription mechanism**.

Important:

* Do not create a second subscriber system.
* Do not duplicate subscriber tables.
* Do not duplicate email APIs.
* Do not create a second discount system.
* Reuse the existing KHEM subscription flow/backend.
* Preserve existing popup functionality.

The current KHEM subscription popup must remain untouched.

For the pre-launch cover, however, it is preferable to provide a deliberate CTA rather than waiting for the existing popup to appear randomly over the cinematic cover.

---

# 8. Existing Subscription Popup

Do NOT delete or modify the current popup.

The pre-launch cover should simply provide another entry point to the existing subscription functionality.

The goal is:

```text
Pre-launch cover
      ↓
JOIN THE INNER CIRCLE
      ↓
Existing subscription mechanism
```

When the pre-launch cover is eventually removed:

```text
Normal KHEM website
      ↓
Existing popup continues normally
```

No duplicated logic.

---

# 9. Do NOT Modify Existing Website Logic

The following must remain unchanged unless technically required to safely mount/unmount the temporary cover:

* Products
* Product pages
* Cart
* Checkout
* Orders
* Customers
* Discounts
* Campaigns
* Subscribers
* CMS
* World of KHEM content
* SEO
* Metadata
* Sitemap
* Robots
* Analytics
* Authentication
* Admin
* Database
* Supabase
* Cloudinary configuration
* Email infrastructure
* Existing popup
* Existing navigation
* Existing footer
* Existing responsive behavior

Do not refactor unrelated code.

Do not "clean up" unrelated components during this task.

Keep the implementation narrowly scoped.

---

# 10. Isolation

Prefer creating a dedicated isolated component:

```text
components/
└── prelaunch/
    └── PrelaunchCover.tsx
```

Additional files can be created if needed:

```text
components/prelaunch/
├── PrelaunchCover.tsx
├── PrelaunchContent.tsx
└── prelaunch.css
```

Use the project's existing architecture and conventions if they differ.

Do not duplicate the entire website inside the pre-launch component.

---

# 11. Production Safety — CRITICAL

The biggest requirement is:

> **The pre-launch cover must NEVER accidentally appear to normal production visitors.**

Do NOT use a permanent hardcoded flag such as:

```ts
const COMING_SOON = true;
```

Do not rely on a developer remembering to change one boolean before launch.

Use an explicit environment/configuration strategy.

> ⚠️ **Superseded — this section proposed `NEXT_PUBLIC_KHEM_PRELAUNCH`, and the
> shipped implementation deliberately does not use it.** Corrected by the
> pre-launch security audit (finding F7,
> `src/docs/SECURITY-AUDIT-STAGE-1.md`). The variable below is the one that
> exists; `src/lib/prelaunch.ts` is the authority.

The flag is **`KHEM_PRELAUNCH`**, server-only, with no `NEXT_PUBLIC_` prefix:

```env
KHEM_PRELAUNCH=false
```

`NEXT_PUBLIC_` was rejected rather than overlooked. Anything carrying that
prefix is inlined into the JavaScript bundle every visitor downloads, which
would publish the fact that a launch is pending, and when it flips, to anyone
who opens devtools. The only reader is `src/proxy.ts`, which runs on the
server and has no need of a public value — see `src/lib/prelaunch.ts:11`.

Production defaults to `false`: the variable is read as "on" only for the exact
string `true` (or `1`), so unset, empty, `false` and every typo all mean the
normal website. Fail-safe is the default state, not an added condition.

**Do not add a `NODE_ENV === "development"` guard.** The concept sketched here
originally would make the cover *impossible to use in production*, which is the
one place it is for — the whole feature exists to hold a live domain closed
before launch day. What keeps production safe is that the flag must be set
deliberately, and that an administrator can preview the cover privately at
`/prelaunch` while it is off, without covering the site for anybody else.

---

# 12. Private Production Preview

The developer needs a way to preview the pre-launch experience on the actual deployed environment without exposing it to normal visitors.

Implement a secure/private preview mechanism appropriate to the existing application architecture.

Desired behavior:

```text
Normal visitor
        ↓
Production domain
        ↓
NORMAL KHEM WEBSITE


Authorized developer preview
        ↓
Production deployment
        ↓
PRE-LAUNCH COVER
```

The preview must NOT be activated by an easily guessable public query parameter alone.

Do not implement something unsafe such as:

```text
?preview=true
```

with no authentication/protection.

Prefer an existing preview/authentication mechanism if the project already has one.

If no suitable mechanism exists, implement the smallest secure solution that fits the current architecture.

The developer must be able to see the current deployed version of the pre-launch experience without exposing it to customers.

---

# 13. Development Workflow

The desired workflow is:

```text
LOCAL DEVELOPMENT
        ↓
Developer sees PRE-LAUNCH
        ↓
Make changes
        ↓
Deploy
        ↓
Private production preview
        ↓
Developer verifies actual production environment
        ↓
Public visitors still see NORMAL WEBSITE
```

This is important because the developer wants to continue changing the pre-launch content/visuals and verify the deployed result without accidentally launching it publicly.

---

# 14. Launch Switch

When KHEM officially launches products, the pre-launch experience should be removable/disabled with minimal effort.

The launch process should be approximately:

```text
1. Disable pre-launch configuration
2. Deploy
3. Verify normal homepage
4. Remove temporary pre-launch code later when safe
```

Do NOT require changes throughout the application.

Do NOT require editing multiple unrelated pages.

Do NOT require database changes.

Do NOT require modifying ecommerce logic.

---

# 15. Route / Layout Strategy

Choose the safest architecture based on the existing KHEM application.

A preferred approach is to mount the pre-launch experience at the highest appropriate presentation level so it can cover the public website while leaving the actual website implementation intact.

However:

**Do not blindly modify the root layout if doing so can interfere with admin, authentication, metadata, server rendering, or other application routes.**

First inspect the current application structure.

Determine:

* App Router structure
* Root layout
* Locale/layout structure if present
* Existing World of KHEM route
* Existing marketing layout
* Admin layout
* Authentication layout
* Metadata implementation
* Existing providers
* Existing popup placement

Then choose the smallest safe integration point.

---

# 16. Admin Must Remain Accessible

The pre-launch cover is for the public storefront experience.

Do not accidentally cover or disable:

```text
/admin
```

or other developer/admin functionality.

The developer must still be able to access the admin dashboard normally.

If the application has other internal/private routes, preserve their existing behavior.

---

# 17. Performance

The video is intentionally the hero experience, so optimize the implementation without damaging visual quality.

Requirements:

* Do not load unnecessary JavaScript.
* Do not create unnecessary client components.
* Do not block the entire application unnecessarily.
* Use the existing Cloudinary URL.
* Consider poster/fallback handling.
* Handle video loading gracefully.
* Handle browsers where autoplay behavior differs.
* Respect `prefers-reduced-motion` where appropriate.
* Avoid layout shift.
* Avoid unnecessary video controls.
* Avoid showing a broken black screen while the video is loading.

The first visual impression should be polished.

---

# 18. Responsive Experience

The cover must be designed intentionally for:

### Desktop

Cinematic fullscreen composition.

### Tablet

Maintain the visual hierarchy without excessive cropping.

### Mobile

Do not simply shrink the desktop design.

Use responsive positioning so:

* Logo remains visible
* Main message remains readable
* World of KHEM remains accessible
* Join KHEM remains accessible
* Video remains visually attractive
* Text does not collide with important visual areas
* Safe areas are respected

---

# 19. Accessibility

Maintain:

* Keyboard navigation
* Visible focus states
* Semantic links/buttons
* Accessible labels
* Sufficient contrast
* Reduced-motion consideration

The video is decorative, so it should not interfere with screen-reader navigation.

---

# 20. SEO

The pre-launch cover must not damage the existing KHEM SEO strategy.

Do not:

* Remove existing metadata
* Change canonical URLs unnecessarily
* Block search engines accidentally
* Add incorrect noindex directives
* Replace the existing sitemap
* Modify robots.txt
* Create duplicate content

Before implementation, inspect how the current application handles SEO.

If the intended pre-launch strategy requires a temporary SEO adjustment, explain it before making it.

Otherwise preserve the existing SEO behavior.

---

# 21. Visual Interaction

Keep animation extremely refined.

Recommended:

* Initial soft fade
* Logo subtle reveal
* Text subtle fade/slide
* CTA appears naturally
* Hover transition around 200–400ms
* No bouncing
* No excessive parallax
* No spinning loaders
* No flashy transitions

The video itself provides most of the movement.

The UI should feel almost invisible.

---

# 22. Do Not Create a Fake Loading Screen

This is NOT:

> "Loading..."

It is a deliberate luxury brand introduction.

The user should immediately understand:

> KHEM is coming.

---

# 23. Final Visual Concept

The intended experience is approximately:

```text
FULLSCREEN CINEMATIC VIDEO

             KHEM

       ESSENCE OF HERITAGE

          COMING SOON


       WORLD OF KHEM  →
       
       JOIN THE INNER CIRCLE
```

Keep it elegant and spacious.

The video remains the hero.

---

# 24. Implementation Process

Before coding:

1. Inspect the existing project structure.
2. Identify the correct public storefront/layout.
3. Identify World of KHEM's real route.
4. Identify the existing subscription mechanism.
5. Identify existing logo/brand assets.
6. Identify existing typography/design tokens.
7. Identify how production/development environments are configured.
8. Identify any existing preview mode.
9. Confirm admin routes will remain unaffected.
10. Decide the smallest safe integration point.

Then implement.

Do not modify unrelated files.

---

# 25. Verification

Before considering the task complete, verify:

### Local

```text
Pre-launch cover visible
Video works
Logo works
World of KHEM works
Subscription works
Mobile works
Desktop works
```

### Normal production behavior

Verify that a normal production visitor still receives the existing KHEM website when pre-launch is disabled.

### Private production preview

Verify the developer can access the deployed pre-launch version privately.

### Admin

Verify `/admin` remains accessible.

### Existing website

Verify existing pages continue to work.

### Build

Run the project's normal:

```text
lint
typecheck
build
```

or the equivalent commands actually defined by the project.

Do not claim success unless the commands were actually executed.

---

# 26. Final Report Required From Claude

At the end of implementation, report:

### Files changed

List every file created/modified.

### Architecture

Explain exactly where the pre-launch cover is mounted and why.

### Production safety

Explain exactly how production is protected from accidental activation.

### Developer preview

Explain exactly how the developer can preview the pre-launch experience on the deployed environment.

### Subscription

Explain how the pre-launch CTA connects to the existing subscription mechanism.

### World of KHEM

Explain the exact route used.

### Launch procedure

Give the exact steps required to disable the pre-launch cover and return the website to normal.

### Verification

Report the actual results of:

* lint
* typecheck
* build
* relevant tests

Do not provide generic instructions. Report what was actually executed.

---

# 27. IMPORTANT — Add This to the Project's Developer Instructions / Future MD Files

At the very end of your implementation report, create a clearly labeled section:

## "How to use this later"

Document the permanent developer workflow for the pre-launch experience.

It must explain:

1. How to enable it locally.
2. How to edit its content.
3. How to replace/update the Cloudinary video.
4. How to preview it privately on production.
5. How to ensure normal customers never see it.
6. How to disable it permanently when KHEM launches.
7. Which environment variables/configuration are involved.
8. Which files should be edited.
9. Which files should NOT be edited.
10. The exact launch checklist.

Use concrete commands, paths, environment variable names, and URLs based on the actual implementation — **do not invent them before inspecting the project.**

This section is important because it will be reused in future developer sessions.

---

# Definition of Done

The task is complete only when:

* [ ] KHEM has a premium fullscreen Coming Soon cover.
* [ ] The provided Cloudinary video is used.
* [ ] Existing KHEM website remains intact.
* [ ] World of KHEM is accessible.
* [ ] Existing subscription system is reused.
* [ ] Existing popup remains untouched.
* [ ] Admin remains accessible.
* [ ] Production defaults to the normal website.
* [ ] Pre-launch cannot accidentally expose itself publicly.
* [ ] Developer has a private production preview mechanism.
* [ ] Local development can show the pre-launch experience.
* [ ] Desktop experience is polished.
* [ ] Mobile experience is polished.
* [ ] SEO is not damaged.
* [ ] Existing ecommerce/business logic is untouched.
* [ ] Lint/typecheck/build pass.
* [ ] Claude provides the exact future usage instructions.
* [ ] Claude provides the exact launch/disable procedure.
