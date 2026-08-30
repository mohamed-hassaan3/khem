# KHEM Complete Redesign & Performance Optimization Specification

## Status

**Major redesign required.**

This document replaces the previous color-mode direction that mixed large dark sections with light Ivory and Sand sections.

After reviewing and using the application, the current visual experience does not feel sufficiently cohesive.

The current mixture of:

* Charcoal / dark sections
* Ivory sections
* Sand sections
* Dark banners
* Dark loading states
* Dark heritage sections
* Dark craft sections

creates too much visual switching between modes.

The application should no longer be designed as a mixture of:

> Dark luxury experience + light shopping experience.

Instead, KHEM must move to one coherent visual system.

---

# 1. New Core Design Direction

## KHEM Must Become a Light-First Luxury Experience

The new primary visual direction is:

> **Ivory + Sand + Warm Neutrals + Charcoal Details**

The application must feel:

* Calm
* Cohesive
* Premium
* Modern
* Warm
* Refined
* Egyptian-inspired
* Comfortable to browse for long periods

The goal is not a generic white e-commerce website.

The goal is a distinctive luxury environment inspired by:

* Egyptian materials
* Stone
* Sand
* Craftsmanship
* Natural warmth
* Modern luxury

---

# 2. Cancel the Previous Dark-First Direction

The previous approach used large dark experiences for:

* Homepage hero
* NOIR
* Heritage
* Craft
* Editorial sections
* Banners
* Loading screens
* Footer
* Other immersive sections

This direction must be reviewed and redesigned.

## Important

Do not simply change:

```text id="wnn1ke"
background: black
```

to:

```text id="7z2s8e"
background: ivory
```

A proper redesign is required.

Every affected section must be reconsidered in terms of:

* Background
* Typography
* Contrast
* Imagery
* Spacing
* Buttons
* Borders
* Cards
* Hover states
* Motion
* Loading states

---

# 3. New Color Philosophy

The KHEM visual system should follow this hierarchy:

> **Ivory is the environment.**
> **Sand creates depth and warmth.**
> **Charcoal creates structure and contrast.**
> **Gold creates small moments of luxury.**

---

# 4. New Primary Color System

## 4.1 Primary Background — KHEM Ivory

### Primary

`#F7F5F0`

This becomes the primary application background.

Use for:

* Main website background
* Homepage
* Shop pages
* Product pages
* Account pages
* Cart
* Checkout
* Editorial pages
* Content pages
* Admin dashboard main surfaces

The user should feel visually comfortable navigating between pages.

---

# 5. Secondary Background — Egyptian Sand

### Secondary

`#E8E1D5`

Use for:

* Section separation
* Heritage storytelling
* Olfactory notes
* Editorial areas
* Secondary content surfaces
* Product detail sections
* Collection introductions
* Cards where additional warmth is required

Sand should create rhythm without creating a completely different visual mode.

---

# 6. Tertiary Background — Soft Stone

Recommended:

`#EFEBE4`

Use when another surface level is required.

Examples:

* Cards
* Form areas
* Secondary containers
* Skeleton backgrounds
* Dashboard panels

Do not introduce unnecessary random neutral colors.

All colors should belong to one coherent system.

---

# 7. Charcoal — Primary Structural Color

### Charcoal

`#242321`

or the closest approved existing KHEM charcoal that provides correct contrast.

Charcoal replaces the previous role of pure black.

## Charcoal is NOT a Dark Mode

Charcoal must primarily be used for:

* Primary typography
* Buttons
* Icons
* Navigation text
* Borders where appropriate
* Footer
* Small strong visual areas
* Image overlays where required

Do not turn the entire application into:

```text id="vmck31"
IVORY
↓
CHARCOAL FULL SCREEN
↓
IVORY
↓
CHARCOAL FULL SCREEN
```

The new system should remain visually continuous.

---

# 8. Pure Black Should Be Removed

Avoid using:

`#000000`

as the primary visual background.

Existing pure black surfaces should be reviewed.

Replace them according to the new design system.

Use:

* Ivory
* Sand
* Soft Stone
* Charcoal

depending on the purpose.

---

# 9. Gold Accent System

## Primary Gold

`#B08D57`

Gold remains an accent.

Use for:

* Fine decorative lines
* Small premium labels
* Selected details
* Hover states
* Focus visual details where appropriate
* Small brand moments

## Darker Accessible Gold

`#8A6A3F`

Use on light backgrounds where stronger contrast is required.

## Rule

Gold must not become the primary UI color.

Avoid:

* Gold backgrounds everywhere
* Large gold buttons everywhere
* Gold text for normal paragraphs
* Excessive gold borders

Gold should feel intentional.

---

# 10. Typography Color System

## Primary Text

Charcoal:

`#242321`

Use for:

* Headings
* Body text
* Navigation
* Product names
* Prices

---

## Secondary Text

Warm gray:

`#625F58`

Use for:

* Descriptions
* Supporting information
* Metadata
* Secondary labels

---

## Muted Text

Recommended:

`#8B867D`

Use carefully for:

* Supporting metadata
* Secondary interface information

Maintain accessibility contrast.

---

# 11. New Surface Hierarchy

The application should primarily use the following hierarchy:

```text id="2sqqts"
LEVEL 1
IVORY
#F7F5F0

↓

LEVEL 2
SOFT STONE
#EFEBE4

↓

LEVEL 3
SAND
#E8E1D5

↓

STRUCTURE / CONTRAST
CHARCOAL
#242321

↓

ACCENT
GOLD
#B08D57
```

This creates a coherent family rather than two completely different visual worlds.

---

# 12. Homepage Complete Redesign

The homepage must be reviewed as a complete experience.

Do not simply recolor the existing homepage.

Review:

* Hero
* Navigation
* Collection sections
* Heritage
* Craft
* Banners
* Cards
* Calls to action
* Newsletter
* Footer
* Scroll animations

---

# 13. Homepage Hero Redesign

## Current Problem

The dark hero contributes to the previous dark/light switching experience.

## New Direction

The hero should belong to the Ivory/Sand system.

Possible approaches:

### Option A — Ivory Editorial Hero

Large product or campaign imagery.

Background:

`#F7F5F0`

Typography:

Charcoal.

Minimal gold details.

---

### Option B — Sand Editorial Hero

Background:

`#E8E1D5`

Use premium photography with large negative space.

---

### Important

Do not automatically add a dark overlay to every hero image.

Image treatment should depend on the photography.

Use:

* Natural contrast
* Subtle gradients
* Charcoal typography
* Carefully controlled overlays

---

# 14. Page Banners

## Major Change Required

Currently, dark banners appear repeatedly across pages.

This creates visual repetition and forces every page into a dark visual mode.

### New Direction

Page banners should primarily use:

* Ivory
* Sand
* Soft Stone
* Photography

Charcoal may be used only when genuinely required.

---

## Banner Design Variations

Do not create one identical banner component for every page.

Create a flexible editorial banner system.

Examples:

### Editorial Banner

Ivory background.

Large typography.

Minimal image.

---

### Collection Banner

Sand background.

Collection imagery.

Charcoal typography.

---

### Image Banner

Full-width photography.

Use overlays only when necessary.

---

### Small Utility Banner

Soft Stone.

Compact layout.

Clear information.

---

# 15. Heritage Section Complete Redesign

The Heritage section must no longer automatically use a dark environment.

The previous visual approach should be reconsidered.

## New Direction

Use:

* Sand
* Ivory
* Natural textures
* Warm photography
* Charcoal typography

Possible subtle material inspiration:

* Egyptian limestone
* Natural stone
* Sand texture
* Paper
* Engraving

Do not use:

* Heavy black backgrounds
* Generic pyramid imagery
* Tourist-style Egyptian visuals

The direction must remain:

> **Modern Egyptian Luxury**

---

# 16. Craft Section Complete Redesign

The Craft section must also move away from automatically using dark backgrounds.

Use:

* Ivory
* Soft Stone
* Sand

The section should communicate:

* Detail
* Human craft
* Ingredients
* Process
* Precision

Charcoal can be used for:

* Typography
* Small details
* Icons
* Dividers

The visual mood should be:

> Calm, tactile, refined.

---

# 17. KHEM NOIR Collection Redesign

## Important

KHEM NOIR does not require the entire page to be black.

The name NOIR is part of the collection identity.

It does not require a permanent dark-mode website experience.

## New Direction

KHEM NOIR should primarily remain inside the new Ivory/Sand ecosystem.

Create distinction through:

* Photography
* Bottle presentation
* Typography
* Charcoal details
* More dramatic composition
* Controlled contrast

Possible special surfaces:

* Charcoal cards
* Charcoal image framing
* Darker editorial details

But avoid making the entire NOIR experience a continuous dark page.

---

# 18. Signature Collection

Primary environment:

Ivory.

Use:

* Charcoal typography
* Warm neutrals
* Small gold details

The experience should feel:

* Elegant
* Clean
* Premium
* Modern

---

# 19. Gemstone Collection

The Gemstone Collection must also follow the new global system.

Do not introduce excessive saturated colors into the UI.

The Gemstone identity should primarily come from:

* Product imagery
* Packaging
* Photography
* Small contextual details

The surrounding interface should remain KHEM.

---

# 20. Navigation Redesign

Navigation must follow the new unified light-first system.

## Default Navigation

Background:

Ivory or transparent over suitable light imagery.

Typography:

Charcoal.

---

## Sticky Navigation

Use:

* Ivory background
* Subtle border
* Minimal shadow if necessary

Avoid large dark navigation bars.

---

## Mobile Navigation

The mobile menu should also follow the Ivory/Sand environment.

Do not automatically open a full-screen black menu.

Use:

* Ivory
* Sand surfaces
* Charcoal typography

Charcoal may be used for selected states.

---

# 21. Footer

The footer must be reviewed.

A Charcoal footer is acceptable because it provides a clear visual ending.

However, it should not feel like switching into an entirely separate dark mode.

Use:

### Background

Charcoal.

### Primary Text

Ivory.

### Secondary Text

Warm muted neutral.

### Accent

Gold.

The transition from the final content section to the footer must feel natural.

---

# 22. Product Cards Redesign

All product cards must follow the new light-first design system.

Primary card environment:

* Ivory
* Soft Stone
* White only where necessary for product photography

Avoid heavy dark product cards by default.

---

## Product Card Structure

Maintain:

```text id="m12i8l"
PRODUCT IMAGE

COLLECTION LABEL

PRODUCT NAME

SHORT DESCRIPTION

PRICE

SHOPPING BAG ACTION
```

---

## Card Rules

All cards must:

* Maintain consistent dimensions
* Maintain consistent image areas
* Control text overflow
* Avoid random height differences
* Work responsively

---

# 23. Product Card Grid

Required responsive behavior:

## Desktop

4 cards per row.

## Tablet

3 cards per row.

## Mobile

2 cards per row.

Use fluid responsive behavior between breakpoints.

---

# 24. Product Card Interaction

The entire product card should navigate to the product details page.

The shopping bag icon should:

* Add the product to the cart
* Prevent parent navigation
* Have an accessible label
* Have clear hover and focus feedback

Do not display a large:

> Add to Cart

text button on every product card.

---

# 25. Product Detail Pages

Product detail pages must follow the new light-first system.

## Main Product Environment

Ivory.

---

## Product Gallery

Use:

* Ivory
* Soft Stone
* Appropriate image framing

The product should have sufficient negative space.

---

## Information

Typography:

* Primary: Charcoal
* Secondary: Warm Gray
* Accent: Gold

---

## Notes

Use Sand or Soft Stone.

---

## Story

Use:

* Ivory
* Sand
* Photography

Charcoal may appear as an accent surface.

Avoid automatically creating a full-screen dark story section.

---

# 26. Discovery Sets

Discovery Sets must be treated as real products.

They require:

* Product cards
* Product detail pages
* Product gallery
* Description
* Included fragrances
* Price
* Size information
* Add to cart

The visual direction should remain inside the Ivory/Sand ecosystem.

---

# 27. Gift Sets

Gift Sets must also be real products.

They require dedicated:

* Product cards
* Product detail pages
* Product imagery
* Included product information
* Price
* Add to cart

Do not treat Gift Sets as static promotional content.

---

# 28. Cart Redesign

Primary environment:

Ivory.

The cart should feel:

* Calm
* Clear
* Premium
* Easy to use

Order summaries may use:

* Soft Stone
* Sand

Primary actions:

Charcoal.

---

# 29. Checkout Redesign

Checkout must prioritize usability.

Primary background:

Ivory.

Order summary:

Soft Stone or Sand.

Primary action:

Charcoal.

Gold should not be the dominant checkout action.

---

# 30. Account Pages

Primary environment:

Ivory.

Use Soft Stone and Sand for:

* Secondary panels
* Information grouping

Charcoal:

* Typography
* Icons
* Important actions

---

# 31. Admin Dashboard Complete Visual Review

The admin dashboard must also be redesigned using the new KHEM visual system.

The dashboard should not be a completely unrelated application.

However:

> Productivity is more important than cinematic design.

---

## Admin Primary Background

Ivory.

---

## Admin Secondary Surfaces

Soft Stone.

Sand may be used sparingly for:

* Information areas
* Special highlights

---

## Admin Navigation

Recommended:

* Ivory or Soft Stone background
* Charcoal typography
* Charcoal active state where appropriate

Avoid unnecessary large dark dashboard environments.

---

## Admin Primary Actions

Charcoal buttons.

Gold should remain an accent.

---

# 32. Responsive Admin Dashboard

The redesign must include:

## Desktop

Efficient data management.

## Tablet

Adaptive sidebar.

Touch-friendly controls.

## Mobile

Navigation drawer or sheet.

Single-column forms.

Responsive data presentation.

Do not simply shrink desktop tables.

---

# 33. Buttons

## Primary Button

Background:

Charcoal.

Text:

Ivory.

---

## Primary Hover

Use subtle changes.

Examples:

* Slight tonal change
* Subtle elevation
* Gold accent
* Border transition

Avoid excessive animations.

---

## Secondary Button

Background:

Transparent or Ivory.

Border:

Charcoal or subtle neutral.

Text:

Charcoal.

---

## Special Premium Button

Gold may be used only where appropriate.

Examples:

* Limited edition
* Exclusive invitation
* Special campaign

Do not make all buttons gold.

---

# 34. Borders

Use warm neutral borders.

Recommended:

`#D8D3CA`

Avoid excessive dark borders.

Borders should be subtle.

---

# 35. Shadows

Reduce heavy shadows.

Luxury should primarily come from:

* Spacing
* Typography
* Materials
* Photography

Use shadows only to establish hierarchy.

Do not make every card float dramatically.

---

# 36. Hover Effects

Hover effects must feel refined.

Recommended:

* Small image scale
* Subtle position change
* Border transition
* Opacity change
* Underline animation
* Small color transition

Avoid:

* Large jumps
* Aggressive rotations
* Constant animations
* Heavy blur effects

---

# 37. Motion and Animation Audit

## Important Performance Requirement

Audit all animations.

The application currently appears to cause excessive runtime work.

Especially investigate:

* Scroll-triggered animations
* Continuous animations
* Large blur effects
* Parallax
* Multiple simultaneous animation libraries
* Repeated re-renders
* Layout animations
* Image transformations
* JavaScript animation loops

---

# 38. Loading States Complete Redesign

Loading screens and loading components must follow the new design system.

Remove unnecessary dark full-screen loading states.

Use:

* Ivory background
* Soft Stone skeletons
* Sand accents where appropriate
* Charcoal loading indicators

Loading should feel calm.

---

## Loading Performance Rule

Do not create expensive loading animations.

Avoid:

* Large animated blurs
* Heavy SVG filters
* Complex infinite animations
* Canvas rendering unless necessary
* Continuous JavaScript loops

---

# 39. Banner and Hero Effects Audit

Audit all visual effects currently used in:

* Hero sections
* Page banners
* Collection banners
* Loading screens

Investigate whether effects are causing:

* High CPU usage
* GPU usage
* Device heating
* Poor mobile performance

Potential expensive effects include:

* backdrop-filter blur
* Multiple layered blur elements
* Large animated gradients
* Large video backgrounds
* Continuous transformations
* Parallax calculations on scroll

Do not remove effects blindly.

Measure their cost.

Keep only effects that add meaningful value.

---

# 40. Complete Performance Investigation

## Current Problem

Lighthouse performance is approximately:

### Desktop

Around:

`72`

### Mobile

Around:

`63`

Additionally, the device becomes noticeably hot, especially when navigating between pages.

This indicates that the application must receive a proper performance investigation.

Do not assume the problem is only images.

Perform an audit.

---

# 41. Required Performance Audit Areas

Investigate:

## JavaScript

Check:

* Bundle size
* Unused JavaScript
* Large dependencies
* Client-side components
* Unnecessary hydration
* Repeated re-renders
* Infinite loops
* Event listener leaks

---

## React / Next.js

Audit:

* Client components that could become server components
* useEffect usage
* useState usage
* Context providers
* Re-render frequency
* Memoization where genuinely required
* Dynamic imports
* Component boundaries

Do not add memoization everywhere blindly.

Identify actual bottlenecks.

---

## Animations

Profile:

* Scroll animations
* Framer Motion or other animation libraries
* Carousel animations
* Continuous animations
* Route transition animations

Respect:

`prefers-reduced-motion`

Where possible.

---

## Images

Audit:

* Image dimensions
* File sizes
* Image formats
* Responsive image sizes
* Next.js image optimization
* Lazy loading
* Above-the-fold image loading
* Unnecessary priority images

Use modern formats where appropriate.

Do not load desktop-sized images unnecessarily on mobile.

---

## Fonts

Audit:

* Number of font families
* Number of font weights
* Font loading strategy
* Blocking font requests

Load only required font weights.

---

## CSS

Audit:

* Large global CSS
* Unused styles
* Expensive visual effects
* Multiple large CSS frameworks
* Heavy filters

---

# 42. Navigation Performance Investigation

The device becomes hot especially during navigation.

This must be investigated specifically.

Profile navigation between pages.

Check for:

* Components unnecessarily remounting
* Large animations on route changes
* Data being refetched unnecessarily
* Images reloading unnecessarily
* Layouts being recreated
* Event listeners being duplicated
* Memory leaks
* Infinite state updates

The solution must be based on evidence.

Do not randomly optimize.

---

# 43. ISR and Vercel Audit

Review the existing ISR implementation.

The recent ISR architecture must be checked for:

* Correct cache boundaries
* Correct revalidation
* Unnecessary revalidation
* Duplicate data requests
* Dynamic rendering where static rendering is possible
* Cache invalidation behavior
* Webhook-triggered updates
* Supabase query patterns

The redesign must not accidentally break:

* Content updates
* Supabase data changes
* Admin dashboard updates
* Product updates
* Collection updates

---

# 44. Required ISR Investigation

Verify each route.

Determine whether it should be:

## Static

For content that rarely changes.

## ISR

For content managed through Supabase that changes periodically.

## Dynamic

Only when genuinely required.

Do not make every route dynamic.

Do not force everything to use the same revalidation strategy.

---

# 45. Supabase Query Performance

Audit:

* Duplicate queries
* Over-fetching
* Queries on every render
* Missing indexes where appropriate
* Sequential requests that could be parallelized
* Excessively large payloads

Only fetch required columns where possible.

Avoid unnecessary:

```text id="7rtkj7"
SELECT *
```

when the application requires only a small subset of data.

---

# 46. Performance Profiling Required

Before and after optimization, measure:

* Lighthouse Desktop
* Lighthouse Mobile
* JavaScript execution
* Main-thread work
* Largest Contentful Paint
* Interaction responsiveness
* Layout Shift
* Bundle sizes
* Route navigation performance

Do not claim performance improvements without measuring them.

---

# 47. Performance Target

The objective should be to significantly improve from the current approximate scores.

Targets should be treated as goals rather than artificial score manipulation.

Aim for:

## Desktop

90+ where realistic.

## Mobile

85+ where realistic.

Maintain:

* Design quality
* Accessibility
* Functionality
* SEO

Do not remove important functionality simply to improve Lighthouse scores.

---

# 48. Device Heating Investigation

Device heating is a high-priority symptom.

Investigate CPU and GPU activity.

Potential causes include:

* Continuous animations
* Excessive JavaScript execution
* Memory leaks
* Expensive CSS effects
* Repeated rendering
* Scroll listeners
* WebGL or Canvas effects
* Route transition work

The application should not continuously consume significant resources when the user is simply reading a page.

---

# 49. New Implementation Strategy

Do not immediately start changing random components.

Follow this process.

---

## Phase 1 — Full Audit

Audit:

* Existing color usage
* Dark sections
* Light sections
* Banner components
* Loading components
* Animation components
* Shared UI components
* Admin UI
* Performance bottlenecks

Create a clear list of findings.

---

## Phase 2 — Design Token System

Centralize the new KHEM color system.

Do not keep scattered color values across the codebase.

Create semantic design tokens.

For example:

```text id="w3c7j8"
--background-primary
--background-secondary
--background-tertiary

--surface-primary
--surface-secondary

--text-primary
--text-secondary
--text-muted

--border-default

--accent-gold

--action-primary
--action-primary-hover
```

Use the project's existing styling architecture.

Do not introduce unnecessary dependencies.

---

# 50. Semantic Color Rules

Components should not think:

> "I need black."

Components should think:

> "I need a primary action color."

The design token system should allow:

```text id="4y8a6s"
Primary Action
→ Charcoal

Primary Background
→ Ivory

Secondary Surface
→ Soft Stone

Warm Section
→ Sand

Premium Accent
→ Gold
```

This prevents future inconsistency.

---

# 51. Phase 3 — Shared Component Redesign

Redesign shared components first.

Including:

* Buttons
* Cards
* Inputs
* Navigation
* Mobile navigation
* Footer
* Banners
* Loading states
* Modal surfaces
* Dropdowns
* Tabs
* Accordions

Ensure all components follow the same new visual system.

---

# 52. Phase 4 — Customer Website Redesign

Redesign systematically:

1. Homepage
2. Collections
3. Shop
4. Product Cards
5. Product Details
6. Discovery Sets
7. Gift Sets
8. Cart
9. Checkout
10. Account
11. About
12. Heritage
13. Craft
14. Journal
15. Other customer pages

Do not redesign pages randomly.

---

# 53. Phase 5 — Admin Dashboard Redesign

After shared components and customer surfaces are stable:

Review:

* Dashboard overview
* Content management
* Product management
* Collections
* Discounts
* Customers
* Orders
* Forms
* Tables
* Analytics
* Navigation

Ensure responsive behavior.

---

# 54. Phase 6 — Performance Optimization

After the visual redesign:

Perform performance profiling.

Prioritize real bottlenecks.

Optimize:

* Images
* JavaScript
* Animation
* Rendering
* Navigation
* Supabase queries
* Caching
* ISR

Then measure again.

---

# 55. Important: Avoid Visual Regression

During the redesign, verify:

* Arabic support
* English support
* Responsive behavior
* Product routing
* Cart functionality
* Checkout
* Discounts
* Customer accounts
* Admin functionality
* Supabase integration
* Clerk integration
* Webhooks
* SEO
* ISR

The redesign must not break existing application functionality.

---

# 56. Final Responsive Requirements

Test all major screens:

## Customer Website

* Desktop
* Laptop
* Tablet landscape
* Tablet portrait
* Mobile

## Admin

* Desktop
* Laptop
* Tablet
* Mobile

Check:

* Overflow
* Touch targets
* Navigation
* Forms
* Tables
* Cards
* Modals
* Typography
* Images

---

# 57. Animation Performance Rules

Animations must be purposeful.

Prefer:

* CSS transforms
* Opacity
* GPU-friendly transitions

Avoid unnecessary animation of:

* Width
* Height
* Top
* Left
* Large blur values

Do not run continuous animations when they are not visible.

Pause or remove animations outside the viewport where appropriate.

---

# 58. Reduced Motion

Respect user preferences.

Support:

```text id="jpe3wf"
prefers-reduced-motion
```

Heavy animations should be reduced or disabled when requested.

---

# 59. Definition of Success

The redesign is successful when:

## Visual Experience

* The application feels like one coherent visual world.
* Navigation between pages does not feel like switching between different websites.
* Ivory is the primary environment.
* Sand provides warmth and visual rhythm.
* Charcoal provides structure and contrast.
* Gold remains a premium accent.
* Pure black is no longer the default brand environment.

---

## User Experience

* Pages feel calm and comfortable.
* Product browsing is easy.
* Information is readable.
* Navigation is intuitive.
* Mobile feels intentionally designed.
* The admin dashboard remains efficient.

---

## Performance

* Navigation feels smooth.
* Device heating is significantly reduced.
* Continuous unnecessary CPU/GPU work is removed.
* Lighthouse scores improve meaningfully.
* ISR works correctly.
* Caching is appropriate.
* Supabase data access is efficient.

---

# 60. Final Design Statement

KHEM is no longer a dark-first luxury website.

The new direction is:

> **A modern Egyptian luxury environment built around Ivory, Sand, warmth, and refined Charcoal contrast.**

The experience should feel like one continuous world.

Not:

> Dark website.
> Then light website.
> Then dark banner.
> Then light shop.
> Then dark loading screen.

Instead:

> **One KHEM environment.**

Built through:

**IVORY — the environment**
**SAND — the heritage**
**CHARCOAL — the structure**
**GOLD — the detail**

---

# Final Instruction Before Implementation

Before changing the application:

1. Read this entire document.
2. Audit the existing application.
3. Identify all existing dark surfaces and color inconsistencies.
4. Identify performance bottlenecks using evidence and profiling.
5. Review the existing ISR architecture.
6. Create a safe implementation plan.
7. Reuse and improve existing architecture where possible.
8. Implement systematically.
9. Test functionality after every major phase.
10. Measure performance before and after optimization.

## Do Not

* Randomly replace black with Ivory.
* Add new dependencies without justification.
* Rewrite stable business logic unnecessarily.
* Break ISR or caching.
* Break Supabase data flows.
* Break Clerk authentication.
* Optimize blindly.
* Remove functionality simply to increase Lighthouse scores.

## Required Final Outcome

Deliver a KHEM application that is:

* Visually unified
* Light-first
* Modern
* Premium
* Egyptian-inspired
* Fully responsive
* Fast
* Efficient
* Comfortable to use
* Maintainable
* Ready for production
