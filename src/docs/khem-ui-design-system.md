# KHEM UI/UX Design System & Responsive Enhancement Specification

## Purpose

This document defines the visual direction, color system, responsive behavior, and required UI enhancements for the KHEM web application.

Claude must use this document as a design and implementation reference when improving the customer-facing website and the admin dashboard.

The goal is to create a consistent, premium, modern, responsive luxury e-commerce experience that reflects KHEM's identity:

> **KHEM — Essence of Heritage**

KHEM should combine:

* Modern luxury
* Egyptian heritage
* Cinematic storytelling
* Premium product presentation
* Comfortable e-commerce usability

The website must not feel like a generic perfume store or a generic black luxury website.

---

# 1. Core Design Philosophy

KHEM should not use only dark mode or only light mode.

The interface must use color intentionally based on the purpose of each page and section.

## The KHEM Color Philosophy

> **Black creates emotion.**
> **Ivory creates comfort.**
> **Sand creates heritage.**
> **Gold creates identity.**

The overall experience should follow this principle:

> **Dark for emotion. Light for shopping. Gold for identity.**

The customer experience should move naturally between cinematic storytelling and comfortable e-commerce browsing.

---

# 2. Core Color System

## 2.1 Obsidian Black

**Color:** `#0D0D0D`

Primary brand dark color.

Use for:

* Homepage hero
* Brand storytelling
* Cinematic campaigns
* KHEM NOIR
* Editorial sections
* Footer
* Dark immersive sections

Emotion:

* Mystery
* Power
* Luxury
* Heritage
* Exclusivity

---

## 2.2 Charcoal Black

**Color:** `#1A1A1A`

Use for:

* Secondary dark backgrounds
* Dark cards
* Dropdown menus
* Modal surfaces
* Secondary NOIR sections
* Admin dark navigation areas where appropriate

Charcoal should provide visual depth without making every dark section look identical.

---

## 2.3 Royal Ivory

**Color:** `#F7F5F0`

This is the primary light background for KHEM.

Do not use pure white as the default background across the entire application.

Use Royal Ivory for:

* Shop pages
* Product listings
* Product detail pages
* Cart
* Checkout
* Account pages
* Editorial reading
* Dashboard content areas

Emotion:

* Elegance
* Comfort
* Premium simplicity
* Clarity

---

## 2.4 Egyptian Sand

**Color:** `#E8E1D5`

Use for:

* Heritage storytelling
* Olfactory notes
* Collection introductions
* Discovery sections
* Warm content areas
* Home fragrance areas
* Storytelling transitions

Emotion:

* Egyptian heritage
* Stone
* History
* Warmth

This color should provide a connection to KHEM's heritage without making the website look like a historical museum or tourism website.

---

## 2.5 KHEM Gold

**Color:** `#B08D57`

Primary brand accent.

Use carefully for:

* Logo details
* Decorative lines
* Small borders
* Hover states
* Premium labels
* Important visual details
* Collection accents

### Important Rule

Gold must remain an accent.

Do not use gold everywhere.

Gold should feel like jewelry:

> Rare, intentional, and valuable.

---

## 2.6 Soft Gold

**Color:** `#D4B77A`

Use sparingly for:

* Hover states
* Premium highlights
* Limited editions
* Special collection details
* Small animations

---

# 3. Typography Color System

## On Dark Backgrounds

### Primary Text

`#F7F5F0`

### Secondary Text

`#B8B3AA`

### Accent Text

`#B08D57`

---

## On Light Backgrounds

### Primary Text

`#151515`

### Secondary Text

`#5F5A52`

### Accent

`#8A6A3F`

The darker gold variation should be used when better contrast is required.

---

# 4. Website Color Distribution

The approximate visual balance across the KHEM website should be:

| Color               | Approximate Usage |
| ------------------- | ----------------: |
| Obsidian / Dark     |               40% |
| Royal Ivory / Light |               40% |
| Egyptian Sand       |               15% |
| Gold Accents        |                5% |

This is not a strict mathematical rule for every page.

It is a visual direction for the overall product.

---

# 5. Landing Page / Homepage

The homepage should feel like a journey.

It should alternate between dark and light environments.

Avoid making the entire page continuously black or continuously white.

---

## Section 1 — Hero

### Mode

**Dark**

### Background

Obsidian Black `#0D0D0D`

Use for:

* Main brand introduction
* Cinematic imagery
* Hero campaign
* KHEM identity

Typography:

* Primary: Ivory
* Accent: Gold

The hero should create the feeling of entering the KHEM world.

---

## Section 2 — Brand Introduction

### Mode

**Sand / Heritage**

### Background

Egyptian Sand `#E8E1D5`

Use this section to create a visual transition after the dark hero.

The section should introduce:

* KHEM
* Essence of Heritage
* Brand philosophy
* Egyptian inspiration

---

## Section 3 — Our Collections

### Mode

**Light**

### Background

Royal Ivory `#F7F5F0`

This section must include the following collections:

1. KHEM NOIR
2. Signature Collection
3. Gemstone Collection

## Important: Collections Must Be a Slider

Do not display the collections as a long static list.

Create a premium responsive collection slider/carousel.

Each collection should have:

* Collection image
* Collection name
* Short description
* Visual identity
* Link or CTA to explore the collection

### Recommended Behavior

#### Desktop

Large editorial cards with multiple cards visible depending on available width.

#### Tablet

Fewer visible cards with horizontal swipe support.

#### Mobile

One primary collection card with part of the next card visible where appropriate to communicate that the section can be swiped.

The slider must support:

* Mouse interaction
* Touch swipe
* Keyboard accessibility where appropriate
* Responsive behavior
* Smooth animations

The design should feel premium and editorial.

Avoid generic default carousel styling.

---

# 6. Collection Visual Direction

## KHEM NOIR

Primary mode:

**Dark**

Colors:

* Obsidian Black
* Charcoal
* Gold
* Ivory

Feeling:

* Mysterious
* Rare
* Cinematic
* Exclusive

---

## Signature Collection

Primary mode:

**Light / Ivory**

Colors:

* Royal Ivory
* Near Black
* Gold accents

Feeling:

* Elegant
* Modern
* Refined
* Sophisticated

---

## Gemstone Collection

Primary mode:

The Gemstone Collection should have its own visual identity while remaining part of the KHEM universe.

Recommended direction:

* Ivory foundation
* Dark contrast
* Subtle gemstone-inspired accents
* Gold details

Do not make the interface overly colorful.

Gemstone colors should primarily appear through:

* Product imagery
* Collection photography
* Small visual accents

The overall KHEM interface must remain cohesive.

---

# 7. Product Card System

All product cards across the customer-facing website should follow one consistent design system.

This includes:

* Perfumes
* Discovery Sets
* Gift Sets
* Future product types

---

## 7.1 Product Grid Requirements

The product grid must be responsive.

### Desktop

**4 product cards per row**

### Tablet

**3 product cards per row**

### Mobile

**2 product cards per row**

The implementation must adapt naturally to intermediate screen widths.

Do not create a layout that only works at exactly three fixed device sizes.

Use responsive grid behavior.

---

# 8. Product Cards Must Have Equal Height

All product cards in the same grid should have consistent visual dimensions.

Product cards must not become different heights because:

* One product name is longer
* One description is longer
* One product has more text

Maintain a clean and aligned product grid.

---

## Content Overflow

Text must be controlled.

For example:

* Product name: limited lines
* Description: limited lines
* Extra text: hidden or line-clamped

Do not allow cards to grow indefinitely.

The goal is visual consistency.

---

# 9. Replace "Add to Cart" with Shopping Bag Icon

## Important UI Change

Remove the visible text button:

> Add to Cart

from product cards.

Instead, use a clear shopping bag icon.

The shopping bag icon should:

* Be recognizable
* Be accessible
* Have an appropriate tooltip or accessible label
* Have visible hover and focus states
* Not interfere with clicking the card

---

## Product Card Interaction

### Clicking the Product Card

The user should navigate to:

> Product Details Page

The card itself should behave as a product discovery and navigation component.

### Clicking the Shopping Bag Icon

The user should perform a quick add-to-cart action.

The shopping bag action must not trigger navigation to the product details page.

Correct event handling and accessibility must be implemented.

---

## Recommended Product Card Structure

```text
PRODUCT IMAGE
────────────────

COLLECTION LABEL

PRODUCT NAME

SHORT DESCRIPTION
(maximum controlled lines)

PRICE

                         [ SHOPPING BAG ICON ]
```

The visual hierarchy should remain minimal and premium.

---

# 10. Product Cards Must Work for All Product Types

The product card system must support:

* Individual perfumes
* Discovery sets
* Gift sets
* Future product categories

Do not build a card system that only assumes every product is a single perfume bottle.

The system should be flexible.

---

# 11. Discovery Sets Product Details

Discovery Sets must have their own product detail pages.

Do not treat Discovery Sets only as promotional cards.

Each Discovery Set must be a proper product.

The detail page should support:

* Product title
* Product images
* Description
* Price
* Included products or fragrances
* Size and quantity information
* Add to cart
* Availability
* Related products where applicable

---

# 12. Gift Sets Product Details

Gift Sets must also have proper product detail pages.

Each Gift Set should support:

* Product title
* Gift set imagery
* Description
* Price
* Products included
* Quantities or sizes
* Add to cart
* Availability
* Related products

The user must be able to navigate from the Gift Set product card to its full detail page.

---

# 13. Product Detail Page Color Structure

The Product Detail Page should prioritize usability and product visibility.

## Product Gallery

### Background

Royal Ivory

The product must have enough visual space.

Do not place every product image on a heavy black background.

---

## Product Information

### Background

Royal Ivory

Typography:

* Product name: Near Black
* Description: Warm Gray
* Accent: Gold

---

## Add to Cart Button

Primary button:

```text
Background: Obsidian Black
Text: Royal Ivory
```

Use subtle gold details or transitions on hover.

Do not make every primary button permanently gold.

---

## Olfactory Notes

### Background

Egyptian Sand

Recommended structure:

```text
TOP NOTES

↓

HEART NOTES

↓

BASE NOTES
```

The section should be elegant and easy to scan.

---

## Product Story / Heritage

### Background

Dark

Use this area for:

* Storytelling
* Campaign imagery
* Inspiration
* Heritage

---

## Ingredients and Additional Information

### Background

Light / Ivory

Keep detailed information readable.

---

# 14. Shop Page

The main Shop experience should primarily use:

## Mode

**Light / Royal Ivory**

Reason:

The user is now shopping.

They need to comfortably:

* Browse
* Compare
* Filter
* Read
* Select products

The shopping environment should be clean.

KHEM's cinematic identity should still appear through:

* Typography
* Product imagery
* Gold details
* Editorial banners
* Collection transitions

---

# 15. Cart

## Mode

Light / Royal Ivory

The cart should prioritize:

* Clarity
* Product information
* Quantity controls
* Price visibility
* Easy checkout

Do not make the entire cart a cinematic dark experience.

---

# 16. Checkout

## Mode

Light / Royal Ivory

Checkout must prioritize:

* Trust
* Clarity
* Readability
* Simplicity

Use:

* Ivory primary background
* Cream or Sand order summary
* Obsidian primary actions

Avoid excessive visual decoration during checkout.

---

# 17. Account Area

## Primary Mode

Light / Ivory

Account pages should be functional and easy to use.

Where appropriate:

* Main content: Light
* Navigation elements: Charcoal or Ivory

Do not sacrifice usability for visual drama.

---

# 18. About KHEM Page

The About page should be one of the strongest storytelling experiences.

Recommended journey:

```text
BLACK
↓
SAND
↓
IVORY
↓
BLACK
↓
IVORY
↓
BLACK + GOLD
```

Suggested content flow:

1. Opening cinematic statement
2. Origins
3. Egyptian heritage
4. Craftsmanship
5. Modern KHEM
6. Closing statement

The page should communicate:

> Modern Egyptian luxury.

Avoid making it look like a historical museum website.

---

# 19. Heritage Page

The Heritage page may use stronger Egyptian material inspiration.

Possible visual references:

* Egyptian stone
* Papyrus-inspired subtle texture
* Black marble
* Gold engraving

Use these as subtle visual materials.

Do not use excessive:

* Pyramids
* Ancient Egypt stock imagery
* Tourist aesthetics

KHEM must remain contemporary.

---

# 20. Journal / Editorial Pages

## Primary Mode

Light / Royal Ivory

Long-form content should be comfortable to read.

### Featured Article

May use a dark editorial card.

### Article Detail

Use primarily light backgrounds.

---

# 21. Discovery Sets Page

Recommended primary mode:

**Egyptian Sand / Cream**

Discovery should feel:

* Curious
* Premium
* Exploratory
* Giftable

---

# 22. Gift Sets Page

Use a premium editorial direction.

Recommended palette:

* Ivory
* Sand
* Black
* Gold accents

Gift Sets should feel special without requiring an entirely separate website design system.

---

# 23. Navigation System

## Navigation Over Dark Hero

Initial state may be:

```text
Background: Transparent
Text: Ivory
```

---

## Navigation After Scrolling

On appropriate light sections:

```text
Background: Royal Ivory
Text: Near Black
```

The navigation should adapt carefully based on:

* Scroll position
* Current page
* Background contrast

Accessibility and text readability are required.

---

# 24. Footer System

The footer should use a consistent identity across the website.

## Primary Background

Obsidian Black.

---

## Typography

```text
Primary Links: Royal Ivory
Secondary Text: Muted Warm Gray
Accent: KHEM Gold
```

---

# 25. Footer Collections Section Must Be Collapsible

## Important Change

The Collections section in the footer must not create a long static vertical list.

Instead, the Collections section should behave like a collapsible navigation group.

For example:

```text
COLLECTIONS                         [+]
```

When expanded:

```text
COLLECTIONS                         [−]

KHEM NOIR
Signature Collection
Gemstone Collection
Discovery Sets
Gift Sets
```

---

## Mobile Footer

On mobile, footer navigation groups should use accordion/collapse behavior.

For example:

```text
SHOP                                +
COLLECTIONS                         +
ABOUT KHEM                          +
CUSTOMER CARE                       +
```

Clicking a section expands its links.

This keeps the footer compact.

---

## Desktop Footer

Do not simply create an extremely long footer.

The footer may use grouped navigation.

Collections can remain compact and expandable where appropriate.

The visual result should be intentional and premium.

---

# 26. Responsive Design Requirements

The entire KHEM platform must be responsive.

This includes:

* Customer website
* Landing page
* Shop
* Product pages
* Cart
* Checkout
* Account pages
* Admin dashboard

Do not treat mobile as an afterthought.

Design must begin with flexible components.

---

# 27. Responsive Screen Strategy

The UI must work across:

## Desktop

Large screens and laptops.

Priorities:

* Spacious layout
* Editorial imagery
* Multi-column layouts
* Efficient dashboard workflows

---

## Tablet

The interface must adapt intentionally.

Do not simply shrink the desktop interface.

Consider:

* Reduced navigation
* Adjusted grids
* Collapsible sidebars
* Touch-friendly controls

---

## Mobile

The mobile experience must be fully usable.

Priorities:

* Touch targets
* Readability
* Simple navigation
* Compact layouts
* Horizontal scrolling only when intentional
* No broken tables
* No inaccessible actions

---

# 28. Responsive Product Grid

Mandatory default behavior:

```text
DESKTOP
4 products per row

TABLET
3 products per row

MOBILE
2 products per row
```

All product cards should:

* Maintain consistent proportions
* Maintain equal height where appropriate
* Have controlled text overflow
* Preserve image quality
* Support touch interaction

---

# 29. Responsive Admin Dashboard

## Important

The admin dashboard must receive the same responsive attention as the customer website.

The dashboard must work properly on:

* Desktop
* Laptop
* Tablet
* Mobile

---

## Desktop Admin

Use the available space efficiently.

Suitable for:

* Data tables
* Multi-column forms
* Analytics
* Management workflows

---

## Tablet Admin

The sidebar may:

* Collapse
* Become icon-based
* Use a temporary drawer

Tables should adapt intelligently.

Avoid forcing users to zoom.

---

## Mobile Admin

The dashboard must remain usable.

Recommended approach:

### Navigation

Use:

* Drawer
* Sheet
* Collapsible menu

---

### Tables

Do not force large desktop tables into tiny screens.

Use appropriate solutions such as:

* Horizontal scrolling where necessary
* Responsive table layouts
* Card representations for selected data
* Progressive information disclosure

---

### Forms

Forms must become:

```text
Desktop:
Multiple columns where appropriate

Mobile:
Single column
```

Inputs and actions must remain touch-friendly.

---

# 30. Admin Dashboard Visual System

The admin dashboard does not need to be completely cinematic.

It should prioritize productivity.

Recommended direction:

## Main Content

Royal Ivory / light surfaces.

## Navigation

Charcoal or Obsidian where appropriate.

## Accent

KHEM Gold used sparingly.

The dashboard should feel:

> Professional KHEM administration.

Not:

> A generic SaaS dashboard.

But usability must remain the highest priority.

---

# 31. Card System

All reusable cards should follow consistent rules.

Examples:

* Product cards
* Collection cards
* Admin cards
* Analytics cards
* Content cards

Rules:

* Consistent border radius
* Consistent spacing
* Controlled shadows
* Clear hierarchy
* Responsive sizing

Do not use excessive:

* Heavy shadows
* Random border styles
* Different card heights without purpose

Luxury should come from:

* Typography
* Spacing
* Photography
* Materials
* Detail

---

# 32. Avoid Visual Problems

Do not create pages consisting only of:

```text
BLACK
BLACK
BLACK
BLACK
BLACK
```

Also avoid:

```text
WHITE
WHITE
WHITE
WHITE
WHITE
```

Create visual rhythm.

The experience should transition naturally between:

```text
DARK
↓
SAND
↓
IVORY
↓
DARK
```

depending on content and purpose.

---

# 33. Accessibility Requirements

All UI enhancements must maintain accessibility.

Ensure:

* Adequate color contrast
* Visible keyboard focus states
* Accessible icon labels
* Accessible buttons
* Accessible navigation
* Accessible accordions
* Keyboard interaction where appropriate

The shopping bag icon must have an accessible label.

For example:

```text
Add [Product Name] to cart
```

Do not rely only on visual meaning.

---

# 34. Implementation Principles

Before creating new components, review existing components and reuse the existing architecture where possible.

Do not create duplicate component systems unnecessarily.

Preferred approach:

1. Audit existing UI components.
2. Identify reusable components.
3. Create or improve design tokens.
4. Build shared responsive primitives.
5. Update components systematically.
6. Avoid breaking existing functionality.
7. Test all screen sizes.

---

# 35. Required Components to Review and Enhance

Review and improve where applicable:

* Navigation
* Mobile navigation
* Footer
* Footer accordions
* Collection slider
* Collection cards
* Product cards
* Shopping bag action
* Product grids
* Product detail pages
* Discovery Set pages
* Gift Set pages
* Cart
* Checkout
* Account pages
* Admin sidebar
* Admin tables
* Admin forms
* Admin cards
* Admin mobile navigation

---

# 36. Product Interaction Rules

## Product Card

### Main Card Click

Navigate to:

```text
/product/[slug]
```

or the existing project routing structure.

---

### Shopping Bag Click

Perform quick add-to-cart behavior.

The event must not trigger the parent card navigation.

---

### Discovery Sets

Must have dedicated product detail pages.

---

### Gift Sets

Must have dedicated product detail pages.

---

# 37. Do Not Break Existing Business Logic

UI improvements must not break:

* Existing product data
* Product routing
* Cart functionality
* Discount logic
* Customer accounts
* Inventory logic
* Existing Supabase integrations
* Admin functionality

This is primarily a UI/UX enhancement unless additional changes are required to support the requested product types and detail pages.

---

# 38. Final Visual Direction

The KHEM website should feel like:

> **You enter through darkness.**
> **You discover the heritage.**
> **You explore the products in light.**
> **You return to darkness.**

The final design should combine:

### Brand Experience

🖤 Dark
🎬 Cinematic
🏛 Heritage
✨ Emotional

with:

### Commerce Experience

🤍 Comfortable
🛍 Product-focused
📖 Readable
⚡ Efficient

---

# Final Design Principle

KHEM should not copy the design language of other perfume websites.

The goal is to create a distinct digital identity:

> **Modern Egyptian Luxury.**

Every design decision should support this balance:

> **Black for emotion.**
> **Ivory for comfort.**
> **Sand for heritage.**
> **Gold for identity.**

---

# Implementation Checklist

Before considering this work complete, verify:

## Color System

* [ ] Dark sections use the defined KHEM dark palette.
* [ ] Shopping sections prioritize Ivory and readability.
* [ ] Sand is used intentionally for heritage and warmth.
* [ ] Gold remains an accent rather than a dominant color.

## Homepage

* [ ] Homepage uses visual rhythm between dark, sand, and light sections.
* [ ] Our Collections includes NOIR.
* [ ] Our Collections includes Signature Collection.
* [ ] Our Collections includes Gemstone Collection.
* [ ] Collections are displayed using a premium responsive slider.

## Product Cards

* [ ] Desktop displays 4 cards per row.
* [ ] Tablet displays 3 cards per row.
* [ ] Mobile displays 2 cards per row.
* [ ] Product cards have consistent dimensions.
* [ ] Long text does not make cards taller.
* [ ] Extra text is controlled or hidden.
* [ ] "Add to Cart" text is removed from product cards.
* [ ] Shopping bag icon is used for quick add to cart.
* [ ] Clicking the card navigates to the product details page.
* [ ] Clicking the shopping bag does not trigger card navigation.

## Product Types

* [ ] Individual perfumes have product detail pages.
* [ ] Discovery Sets have product detail pages.
* [ ] Gift Sets have product detail pages.
* [ ] Product card components support all product types.

## Footer

* [ ] Footer Collections navigation is compact.
* [ ] Footer collection links can collapse/expand.
* [ ] Mobile footer uses accordion navigation.
* [ ] Footer does not become unnecessarily long.

## Responsive Website

* [ ] Desktop is tested.
* [ ] Tablet is tested.
* [ ] Mobile is tested.
* [ ] Navigation works on all screen sizes.
* [ ] Product grids work on all screen sizes.
* [ ] Forms work on all screen sizes.

## Responsive Admin Dashboard

* [ ] Desktop dashboard works efficiently.
* [ ] Tablet sidebar adapts.
* [ ] Mobile navigation uses a drawer or equivalent solution.
* [ ] Tables remain usable on mobile.
* [ ] Forms adapt to single-column layouts on mobile.
* [ ] Buttons and controls remain touch-friendly.

## Quality

* [ ] No unnecessary duplicate components.
* [ ] Existing functionality remains intact.
* [ ] Accessibility is maintained.
* [ ] Keyboard interaction works where appropriate.
* [ ] UI feels consistent across customer and admin experiences.
* [ ] The final experience feels like KHEM, not a generic template.
