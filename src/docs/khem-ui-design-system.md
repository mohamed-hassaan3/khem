# KHEM UI/UX Design System & Responsive Enhancement Specification

> **Status: superseded in part, and rewritten here.**
>
> Sections 1–5 of this document previously specified a *dual-mode* system —
> large dark environments for storytelling, light ones for shopping — and a
> homepage that deliberately alternated between them. That direction has been
> withdrawn. See `src/docs/KHEM-REDESIGN-AND-PERFORMANCE.md` for the brief that
> replaced it and `prompts/light-first-redesign-and-performance.md` for the
> implementation record.
>
> Everything from § 6 onward — collection direction, the product card system,
> grids, responsive rules, admin layout — was written independently of the
> colour question and still stands. Only the colour and section-mode sections
> below have been rewritten.

## Purpose

This document defines the visual direction, colour system, responsive behaviour
and required UI enhancements for the KHEM web application.

Claude must use this document as a design and implementation reference when
improving the customer-facing website and the admin dashboard.

The goal is a consistent, premium, modern, responsive luxury e-commerce
experience that reflects KHEM's identity:

> **KHEM — Essence of Heritage**

KHEM combines modern luxury, Egyptian heritage, editorial storytelling, premium
product presentation and comfortable e-commerce usability. It must not feel like
a generic perfume store — and, since this revision, it must not feel like a
generic black luxury website either.

---

# 1. Core Design Philosophy

**KHEM is one light environment.**

It is not a dark site with light sections in it, and it is not a site that
switches modes according to what a page is doing. Navigating from the home page
to a collection to a product to the bag to the account portal to the dashboard
must never cross a dark/light boundary.

The hierarchy, in one line:

> **Ivory is the environment. Stone is the surface above it. Sand carries
> warmth and rhythm. Charcoal is structure. Gold is jewellery.**

## Why this replaced the dual-mode system

The previous philosophy assigned a mode per section: dark for heritage, craft,
NOIR, banners and loading; light for shopping. Each decision was defensible on
its own. Together they produced a site that changed lights roughly every screen
and a half, and a visitor moving through a normal purchase crossed the boundary
six or seven times.

The failure was not any one dark section. It was that "which mode is this?"
became a question every new surface had to answer, and there was no wrong
answer — so the answers diverged, and the site stopped reading as one place.

---

# 2. Core Colour System

The canonical values live in `@theme` in `src/app/globals.css`. That file is the
implementation; this is the reasoning.

## 2.1 Ivory — the environment

`#F7F5F0` · token `--color-ivory` · ground `.ground-ivory`

The ground of the site. Home, shop, product, cart, checkout, account, editorial,
admin. If a surface has no reason to be anything else, it is this, and most
surfaces have no reason to be anything else.

## 2.2 Soft Stone — the surface above the environment

`#EFEBE4` · token `--color-stone` · ground `.ground-stone`

Cards, form fields, dashboard panels, order summaries, skeletons. Anywhere a
region must read as *on* the page rather than as the page.

Replaces the former `--color-cream` (`#FBFAF7`), a near-white that existed to
read as lifted against obsidian. On ivory it was indistinguishable from the
ground, so a card drawn in it had no surface of its own.

## 2.3 Egyptian Sand — warmth and rhythm

`#E8E1D5` · token `--color-sand` · ground `.ground-sand`

Heritage storytelling, olfactory notes, editorial breaks, collection
introductions, the transition into the footer.

Sand is *punctuation*, not alternation. Two sand sections with one ivory section
between them reads as stripes, which is the switching problem in warmer clothes.

## 2.4 Charcoal — structure

`#242321` · token `--color-ink` · ground `.ground-charcoal`

Primary typography, buttons, icons, navigation text, borders where a hairline is
not enough — and the footer, which is the one full-width charcoal surface in the
system.

Charcoal is **not a dark mode**. The footer is charcoal because a document needs
an ending, and it is the *same colour* as the type on every light page above it,
so it reads as the palette's structural colour filling the frame rather than as
a different environment.

It is `#242321` rather than the former `#151515`: as the only structural colour
on an ivory page it has to read as warm charcoal, not as a hole. Contrast on
ivory is 13.4:1.

## 2.5 KHEM Gold — the accent

`#B08D57` · token `--color-gold`
`#8A6A3F` · token `--color-gold-deep` — **the gold that survives as text on a
light ground**

Fine rules, small premium labels, selected states, hover details, the house
speaking about itself.

### Important rule

Gold is never the primary UI colour. No gold page backgrounds, no gold primary
buttons in a commerce flow, no gold body copy, no gold borders by default. Target
is roughly 5% of any visible surface.

**Choosing between the two golds is an accessibility decision, not a shade
preference.** `--color-gold` on ivory is about 2.6:1 and fails at body size;
`--color-gold-deep` is about 4.9:1. Gold on a light ground takes the deep one —
and every light ground sets `--ground-accent` to it automatically, so a component
that writes `text-ground-accent` cannot get this wrong.

## 2.6 Obsidian — framing only

`#0D0D0D` · token `--color-background` · ground `.ground-obsidian`

**Not a page ground.** No route renders on this. What survives is the framing
case: the inside of a full-bleed image, a lightbox scrim, a product well where a
photographed bottle needs a dark surround. In every one of those the dark area is
bounded by an image, not by the page.

If you are reaching for obsidian to make a *section* dramatic, the answer the
system wants is photography, charcoal detail and composition.

---

# 3. Typography Colour System

Text colours are named for the ground they sit on, because the mistake this
system makes possible is using a dark-ground colour on a light one.

| Role | Token | Value | On ivory |
| --- | --- | --- | --- |
| Primary | `--color-ink` | `#242321` | 13.4:1 |
| Secondary | `--color-ink-muted` | `#625F58` | 6.2:1 |
| Muted | `--color-ink-subtle` | `#8B867D` | 3.6:1 |
| Accent | `--color-gold-deep` | `#8A6A3F` | 4.9:1 |
| On charcoal | `--color-ivory` / `--color-dim` | `#F7F5F0` / `#B8B3AA` | — |

`--color-ink-subtle` is above the 3:1 floor for large text and UI and below the
4.5:1 body floor. It is for chrome and metadata, never for a paragraph.

## Never write an opacity of a fixed colour

`text-ivory/40` was the idiom that made the old site dark-only: an opacity of a
fixed colour cannot be correct on more than one ground. Use the ground-relative
utilities — `text-ground`, `text-ground-muted`, `text-ground-subtle`,
`text-ground-accent`, `border-ground-border` — which resolve against whichever
`.ground-*` they land inside, including under `hover:`, `group-hover:` and
breakpoint variants.

---

# 3a. Semantic Tokens

Components should not think *"I need charcoal"*. They should think *"I need a
primary action"*. The vocabulary, layered over the ground machinery:

```
--background-primary     ivory      --text-primary       charcoal
--background-secondary   stone      --text-secondary     warm grey
--background-tertiary    sand       --text-muted         subtle grey
--surface-primary        stone      --border-default     #D8D3CA
--surface-secondary      sand       --accent-gold        deep gold
--action-primary         charcoal   --action-primary-hover  black
```

The three background levels are fixed rungs and are deliberately *not*
ground-relative: `--background-secondary` means stone everywhere, which is what
makes "one level up from the page" a portable instruction.

---

# 3b. The Ground Contract

A section declares one of `.ground-ivory`, `.ground-stone`, `.ground-sand`,
`.ground-charcoal` or `.ground-obsidian`, and gets its background, foreground,
muted tone, accent, hairline, button fill, field fill and card surface together.

**Never write `bg-ivory` and hope.** Write `ground-ivory` and the type comes
with it. The failure this prevents was everywhere in the old system: a component
wrote `bg-surface`, inherited `text-ivory` from `body`, and worked only because
every ancestor happened to be dark.

An overlay — drawer, modal, mega-menu, banner — is its own surface and must
declare its ground explicitly, even though it is a descendant in the tree.

---

# 4. Website Colour Distribution

| Colour | Approximate usage |
| --- | ---: |
| Ivory | 65% |
| Sand | 15% |
| Stone | 12% |
| Charcoal (footer, buttons, type) | 5% |
| Gold | 3% |

Not a mathematical rule per page. It is the balance the product should read at,
and it replaces the previous 40/40 dark-light split.

---

# 4a. The Banner System

There is no single banner component recoloured per page. §14 of the redesign
brief asks for four shapes, and the site implements four:

| Shape | Ground | Where |
| --- | --- | --- |
| **Editorial** | Ivory, large type, minimal image | Home hero |
| **Collection** | Photography with an ivory scrim, charcoal type | `CollectionView` |
| **Category** | Photography with a directional ivory gradient | `CategoryHero` |
| **Utility** | Compact, short, quiet | `LegalHero` |

Two rules hold across all four:

**Do not automatically darken a hero image.** Every banner on the old site ran a
blanket `brightness-20`–`brightness-45`, which is what made them all the same
dark rectangle and threw away the photography. Images now run at their own
luminance; a *bounded* gradient carries the type.

**Type on a banner is charcoal.** Which means the scrim's job is to guarantee a
light field under the words, not a dark one.

## The scrim, and its three anchors

The gradient is **not** hand-written per banner. `globals.css` defines
`.banner-scrim` plus three anchors, and every banner on the site declares one:

| Anchor | For | Used by |
| --- | --- | --- |
| `.banner-scrim-base` | Type on the bottom edge | Collection banner, journal article, legal page, home collection card, nav tiles |
| `.banner-scrim-column` | Type in a reading column | Category mastheads, Heritage, About, Ingredients |
| `.banner-scrim-center` | Type centred over the frame | New Arrival, Craftsmanship, the stockists map |

A shared *treatment*, not a shared component: each banner keeps its own layout,
height and composition and only states where its type sits.

**Every anchor holds the reading area at or above ~70% ivory**, whatever the
photograph does there. Ivory at 70% over black resolves to about `#adaba6`, and
charcoal on that is ~4.6:1 — clear of the 4.5:1 body floor, which is what
"readable on any banner" has to mean for a 10px eyebrow. Display type only needs
3:1; the small type is the binding constraint and the numbers are set by it.

`.banner-scrim-column` carries *two* layers for that reason. The directional
wash gives the composition and lets the picture through on the trailing side;
the bottom layer is the guarantee. A directional wash alone is what this
replaced, and it failed exactly where you would expect — on
`/collections/body-care` it had faded to nothing under the eyebrow and the lede,
leaving charcoal type on a dark vase. Thinning either layer breaks the darkest
photography first, and silently.

## Cards do not dim their photographs

A card's caption sits in its own panel *below* the image, so dimming the
photograph buys no legibility. The grades that used to be there — from
`brightness-75` on a product card to `brightness-[0.15] saturate-0 sepia-[0.3]`
on the stockists map — were left over from the dark system, where a card's type
lay on the picture. They cost image quality and bought nothing (§41).

The one exception is a card whose type really is over the image: it takes a
scrim anchor, like a banner, rather than a filter.

Noir is the only photography that is still graded, and it is *lifted*
(`brightness-105`) rather than dimmed, so it joins the light system instead of
being the one surface that stays dark. `<CollectionCard tone="dark">` and
`<CollectionView>` apply the same value, so the home page and the collection
banner agree about what NOIR looks like.

---

# 5. Landing Page / Homepage

The homepage should feel like a journey.

It moves between **ivory and sand**, and it does not change lights. The
"alternate between dark and light environments" instruction this section used to
carry is exactly what the redesign removed.

The rhythm as built, top to bottom:

```
IVORY   hero
SAND    collections preview
IVORY   essences
SAND    brand story
IVORY   craftsmanship
[image] featured perfume — a photograph, not a ground
SAND    collection slider
IVORY   journal
IVORY   testimonials
SAND    newsletter
CHARCOAL footer
```

One dark band in eleven sections, and it is a full-bleed photograph of a bottle
bounded by light on both sides — punctuation, not alternation.

---

## Section 1 — Hero

### Mode

**Ivory editorial** (§13, Option A of the redesign brief)

### Background

Royal Ivory `#F7F5F0`

The wordmark, a gold rule, the tagline, one primary action, and two concentric
circles drawn in charcoal at 5–8% — an engraving on paper.

Typography:

* Primary: Charcoal
* Accent: Deep gold

### What was removed, and why it should not come back

A full-bleed photograph at `opacity-35` under a radial gradient that faded to
solid obsidian. At that opacity under that wash it was not photography, it was
texture — work an ivory ground does for free. It was also a 1800px `priority`
image on the critical path of the most-visited route, spent on a composition
that is typographic.

When a real KHEM campaign photograph exists it belongs here **full-bleed and
untreated**, with the type moved off it — not layered under it at a third of its
opacity.

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

**Ivory, like everything else** — §17 of the redesign brief is explicit that the
collection's name does not entitle it to a dark website.

Colours:

* Royal Ivory — the page
* Charcoal — type, and the framing around its photography
* Gold — the accent, unchanged

Where the distinction actually comes from:

* Photography, graded darker than the other collections
* Bottle presentation and composition
* More dramatic crops
* Charcoal detail, used more heavily than elsewhere

Feeling:

* Mysterious
* Rare
* Cinematic
* Exclusive

The banner image for `noir` is lifted rather than dimmed (`brightness-105` in
`CollectionView`), so it joins the light system instead of being the one page
that still goes dark. The drama is in the picture.

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

# 34. Animation & Motion System

KHEM uses motion to enhance the luxury experience, guide attention, and create a sense of refinement. Animations must remain **subtle, smooth, and purposeful**. Avoid excessive motion, flashy effects, or animations that make the interface feel like a generic e-commerce website.

### 1. Scroll-Triggered Section Reveal

Major landing-page sections should reveal naturally as the visitor scrolls.

**Default behavior:**

* Initial: `opacity: 0`, `translateY(24px)`
* Enter viewport when approximately 15–20% is visible.
* Animate to `opacity: 1`, `translateY(0)`.
* Duration: approximately `600–800ms`.
* Use a smooth ease-out curve.
* Animate **once only**; do not replay when scrolling back.
* Unobserve the element after it has appeared.

For sections with multiple elements, use subtle staggered timing:

```text
Heading
   ↓ ~100ms
Description
   ↓ ~100ms
CTA / supporting content
```

Use a **single reusable reveal mechanism** across the website rather than separate animation logic for every section.

The implementation should match the project's existing stack and architecture. Prefer the simplest maintainable solution already supported by the project.

### 2. KHEM Directional Motion

Not every section needs the exact same movement.

Use subtle variations where they improve the editorial composition:

* Standard sections → upward reveal.
* Alternating editorial/image sections → very subtle horizontal movement.
* Product imagery → gentle fade/scale where appropriate.
* Text → primarily fade + translate.
* Avoid large or exaggerated movement.

Motion should never compete with the product photography or typography.

### 3. Product & Card Interactions

Product and editorial cards may use restrained hover interactions:

* Image transition/zoom: very subtle.
* Content movement: minimal.
* CTA/button transition: smooth.
* No excessive scaling or bouncing.

The interaction should feel closer to a **luxury editorial website** than a typical e-commerce interface.

### 4. Carousel Motion

Where KHEM uses a carousel, such as the landing-page collection sections, use a smooth editorial transition.

**Responsive behavior:**

* Desktop: 2 cards visible.
* Tablet/mobile: adapt naturally to the available width, with mobile showing 1 card where appropriate.

Carousel behavior:

* Smooth horizontal `translateX` transition.
* Approximately 5–6 seconds autoplay.
* Pause on hover and keyboard focus.
* Resume after interaction.
* Touch/swipe support.
* Keyboard arrow navigation when focused.
* Handle a single slide gracefully without unnecessary controls.

### 5. Carousel Progress Indicator

Do not use traditional bullet dots for premium KHEM carousels.

Use a minimal horizontal progress track:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
████████
```

The filled portion represents the active slide and progresses toward the next slide.

The progress animation should reset when the slide changes.

Keep the indicator:

* Thin.
* Minimal.
* Elegant.
* Visually secondary to the content.

### 6. Popup & Modal Motion

Marketing popups, including the subscribe/special-offer popup, should enter and exit smoothly.

Preferred direction:

```text
opacity: 0 → 1
subtle scale / translate → natural position
```

Keep the movement short and refined.

Do not use aggressive bounce effects.

The popup should feel like an invitation rather than an interruption.

### 7. Announcement Bar Motion

For announcement marquees:

* Use smooth continuous movement.
* Avoid abrupt jumps.
* Respect reduced-motion preferences.
* Carousel announcements should transition smoothly rather than abruptly changing content.

### 8. Reduced Motion & Graceful Degradation

All KHEM animations must respect:

```text
prefers-reduced-motion: reduce
```

When reduced motion is enabled:

* Show content immediately.
* Disable non-essential transitions.
* Keep functionality unchanged.

Content must remain usable if JavaScript fails or an animation cannot initialize.

Animations must never hide important content permanently.

### 9. Performance Rules

Animation should use performant properties such as:

* `transform`
* `opacity`

Avoid unnecessary animation of layout properties such as:

* `top`
* `left`
* `width`
* `height`

Do not introduce a large animation library when the existing project can achieve the required behavior with lightweight reusable utilities.

### KHEM Motion Principle

**Motion should be felt, not noticed.**

Every animation should support one of three purposes:

1. **Guide** — help the visitor understand where to look.
2. **Reveal** — create a refined sense of discovery while scrolling.
3. **Elevate** — make interactions feel premium.

If an animation does not serve one of these purposes, it should probably not exist.


# 35. Implementation Principles

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

# 36. Required Components to Review and Enhance

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

# 37. Product Interaction Rules

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

# 38. Do Not Break Existing Business Logic

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

# 39. Final Visual Direction

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
