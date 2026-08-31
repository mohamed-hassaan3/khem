# KHEM — Hero Landing Page & Announcement Upgrade

## Purpose

Upgrade the **Landing Page Hero** and **Marketing / Announcement carousel** using the existing KHEM design system and CMS architecture.

This is an enhancement task only.

### Important

* Inspect the existing implementation first.
* Follow all existing `AGENTS.md`, UI/design MD files, CMS architecture, and project conventions.
* Do not create a parallel CMS/content system.
* Reuse existing components, database structures, services, validation, localization, and admin patterns wherever possible.
* Do not break the currently working CMS.
* Do not modify or reopen deferred `ADMIN-CMS-FINAL-ARCHITECTURE` items unless strictly required.
* Preserve existing EN/AR support.
* Preserve the current KHEM light-first / ivory premium visual direction.
* Keep the implementation responsive and performant.

---

# 1. HERO — LANDING PAGE

## Goal

Redesign the current Landing Page Hero so it can support **multiple visual slides**, while keeping the KHEM premium, minimal, elegant visual language.

The Hero must support:

### Option A — Image Slider

Admin should be able to configure 1/2/**3 images or more**.

The admin interface must include an **“Add Image”** control so the admin can add additional Hero images as needed.

The customer experience should be:

* Support 1/2/3 images or more.
* Images rotate automatically.

Example:

`Image 1 → fade → Image 2 → fade → Image 3 → fade → Image 1`

Do not use an aggressive carousel effect.

The transition should feel closer to a luxury editorial / perfume campaign website.

---

# 2. HERO — VIDEO SUPPORT

The Hero should also support a **single video**.

Important:

### Video is NOT part of the 3-image slider.

The admin should choose the Hero media type:

* `Images`
* `Video`

### Images

If `Images` is selected:

* Allow up to 3 images.
* Use the fade/timer/progress behavior described above.

### Video

If `Video` is selected:

* Allow only **one video**.
* Do not create a video slider.
* Video occupies the Hero visual area.
* Autoplay where browser policy allows.
* Muted by default.
* Loop where appropriate.
* Provide a graceful fallback/poster image.
* Do not allow multiple videos.

The admin UI should make this distinction very clear.

---

# 3. HERO CONTENT CONTROLS

The Hero needs optional content controls.

Admin should be able to independently enable/disable:

* Headline
* Description
* Button

These must be optional.

For example:

### All enabled

Headline
Description
Button

### Headline only

Headline

### Button only

Button

### Nothing

Pure visual Hero with no text/content overlay.

Do not force empty placeholders onto the frontend.

If a field is disabled or empty, it should not render.

---

# 4. HERO BUTTON

When enabled, support the existing project-standard button/link behavior.

Admin should be able to configure:

* Button label EN
* Button label AR
* Button URL
* Optional external/internal link behavior if already supported by the project

Do not invent a new routing/link system.

Reuse the existing KHEM implementation.

---

# 5. HERO LOCALIZATION

The Hero must continue to support:

* English
* Arabic

At minimum:

* Headline EN / AR
* Description EN / AR
* Button label EN / AR

Respect the application's existing locale routing and RTL behavior.

Do not introduce `/en/...` assumptions if the existing project uses unprefixed English URLs.

---

# 6. HERO CONTENT ANIMATION

When Hero text/content is enabled, animate the content into view elegantly.

Required sequence:

1. Headline appears
2. Description appears
3. Button appears

Use a subtle **slow show-up / fade + slight movement** effect.

Requirements:

* Premium and restrained.
* No aggressive bouncing.
* No distracting motion.
* Respect `prefers-reduced-motion`.
* Do not cause layout shift.
* Animation should work correctly when changing between Hero slides.

The animation should feel like content is being revealed rather than "animated UI."

---

# 7. HERO RESPONSIVE BEHAVIOR

Audit the Hero carefully on:

* Desktop
* Tablet
* Mobile

Pay particular attention to:

* Hero height
* Image/video cropping
* Text positioning
* Button positioning
* Progress bar
* Readability
* RTL
* Touch interaction
* Safe areas on mobile

Do not make the mobile Hero unnecessarily full-screen if that conflicts with the current KHEM design.

Preserve the current navigation/banner relationship already established in the project.

---

# 8. HERO ADMIN / CMS

Extend the **existing Landing Page CMS**.

Do not create another admin page.

The editor should make the configuration understandable.

Suggested structure:

### Hero Media

`Media Type`

* Images
* Video

### Images

* Image 1
* Image 2
* Image 3
* Upload/select media
* Alt EN
* Alt AR

### Video

* Video
* Poster/fallback image
* Alt/accessibility information where applicable

### Timing

* Slide duration

Use a sensible default and allow future adjustment.

### Content

Toggle:

`Show Headline`
`Show Description`
`Show Button`

Then:

Headline EN / AR
Description EN / AR
Button Label EN / AR
Button URL

Only show relevant fields based on the selected options.

---

# 9. HERO VALIDATION

The CMS must prevent invalid configurations.

Examples:

### Images selected

Valid:

* 1 image
* 2 images
* 3 images

Invalid:

* More than 3 images.

### Video selected

Valid:

* Exactly 1 video.

Invalid:

* Multiple videos.
* Video slider configuration.

### Content

Empty optional fields should not produce broken UI.

Do not allow the admin to save a configuration that can result in a broken Hero.

Use the existing project validation/schema patterns.

---

# 10. PERFORMANCE

The Hero is above the fold and therefore performance-critical.

Optimize it carefully.

Requirements:

* Do not unnecessarily load all heavy assets immediately.
* Use appropriate image optimization already available in the project.
* Avoid layout shift.
* Avoid unnecessary JavaScript.
* Do not introduce a heavy carousel library if the existing stack can implement this cleanly.
* Video must not unnecessarily destroy mobile performance.
* Respect existing Next.js image/video optimization patterns.

The first visible Hero should remain fast.

---

# 11. MARKETING / ANNOUNCEMENTS

## Goal

Improve the existing rotating Announcement / Marketing bar.

Current behavior already rotates messages.

Keep the existing automatic rotation.

Add manual navigation.

### Add:

* Left arrow
* Right arrow

The arrows should allow the customer to manually move between announcement messages.

Example:

`←  Message 1  →`

If the customer missed a message because it automatically rotated away, they should be able to go back.

---

# 12. ANNOUNCEMENT BEHAVIOR

Maintain:

* Automatic rotation
* Existing timer behavior
* Existing visual style
* Existing CMS/admin management
* EN/AR support

Add:

### Previous

Clicking the left arrow:

* Shows the previous message.
* If currently on the first message, either loop to the last message or follow the existing carousel convention.

### Next

Clicking the right arrow:

* Shows the next message.
* If currently on the last message, loop to the first message.

Choose the behavior that best matches the existing carousel implementation and document it.

---

# 13. ANNOUNCEMENT UX

The arrows must be:

* Small
* Elegant
* Clearly clickable
* Accessible
* Appropriate for the KHEM premium design

Do not make the announcement bar look like a generic ecommerce carousel.

On mobile:

* Ensure arrows do not overlap important text.
* Keep the message readable.
* Maintain adequate touch target size.
* Prevent horizontal overflow.

---

# 14. MANUAL + AUTOMATIC ROTATION

Important:

Manual navigation must work together with automatic rotation.

When the customer clicks:

`←` or `→`

the timer should reset/restart for the newly displayed message.

Do not immediately auto-rotate away after a manual click.

Avoid timer conflicts or multiple intervals.

Make sure only one rotation timer is active.

---

# 15. ACCESSIBILITY

For both Hero and Announcements:

* Keyboard accessible controls.
* Proper button semantics.
* Accessible labels for arrows.
* Images require appropriate alt text.
* Decorative images should be treated appropriately.
* Video should be accessible.
* Respect `prefers-reduced-motion`.
* Do not rely only on animation to communicate information.

Suggested accessible labels:

* Previous announcement
* Next announcement

Use the application's existing localization/accessibility conventions where available.

---

# 16. SEO

Do not reduce existing SEO quality.

For Hero:

* Preserve meaningful image alt text.
* Do not put critical SEO content only inside an inaccessible visual element.
* Avoid rendering duplicate headings from multiple slides if that would create an SEO problem.
* Preserve the existing page's semantic heading hierarchy.

For announcements:

* Do not turn the announcement carousel into a collection of unnecessary SEO headings.

---

# 17. IMPLEMENTATION RULES

Before coding:

1. Inspect the current Hero implementation.
2. Inspect the current Landing Page CMS.
3. Inspect the current Announcement implementation.
4. Inspect the existing database/schema.
5. Inspect existing media upload/storage patterns.
6. Inspect existing animation patterns.
7. Inspect existing responsive behavior.
8. Inspect existing EN/AR handling.
9. Inspect relevant `AGENTS.md` and UI/design documentation.

Then implement using the existing architecture.

Do not rewrite unrelated components.

Do not modify unrelated CMS functionality.

---

# 18. TESTING

After implementation, test:

## Hero

* [ ] 1 image works
* [ ] 2 images work
* [ ] 3 images work
* [ ] Images fade correctly
* [ ] Timer works
* [ ] Progress bar works
* [ ] Hero loops
* [ ] Video works
* [ ] Video is single-media only
* [ ] Poster/fallback works
* [ ] Headline can be enabled/disabled
* [ ] Description can be enabled/disabled
* [ ] Button can be enabled/disabled
* [ ] All content disabled works
* [ ] EN works
* [ ] AR works
* [ ] RTL works
* [ ] Mobile works
* [ ] Tablet works
* [ ] Desktop works
* [ ] Reduced motion works
* [ ] No layout shift
* [ ] No console errors

## Announcement

* [ ] Automatic rotation still works
* [ ] Left arrow works
* [ ] Right arrow works
* [ ] Manual navigation works
* [ ] Timer resets after manual navigation
* [ ] First/last message behavior works
* [ ] Mobile works
* [ ] Desktop works
* [ ] EN works
* [ ] AR works
* [ ] RTL works
* [ ] Keyboard navigation works
* [ ] Accessible labels exist
* [ ] No duplicate timers
* [ ] No console errors

---

# 19. CMS ROUND TRIP

Before declaring complete, perform a real production-like CMS test:

### Hero

Admin:

`Edit → Save → Refresh Admin → Verify → Open Public Landing Page`

Verify the change is actually visible.

Test at least:

* Image change
* Text change
* Button change
* Enable/disable content

### Announcement

Admin:

`Edit announcement → Save → Refresh → Public website`

Verify:

* Message appears.
* Rotation works.
* Arrows work.

---

# 20. FINAL REPORT

After implementation, do NOT simply say "done."

Report:

### Implemented

List the exact changes.

### CMS

Explain what new Hero controls were added.

### Database

List any migrations/schema changes.

### Frontend

List the new Hero and Announcement behavior.

### Testing

Report what was actually tested.

### Browser Verification Required

List anything that still requires manual browser verification.

### Deferred

Do not include unrelated deferred `ADMIN-CMS-FINAL-ARCHITECTURE` features as implementation failures.

---

# Definition of Done

This task is complete only when:

* Existing KHEM CMS architecture remains intact.
* Hero supports up to 3 image slides.
* Images use elegant fade transitions.
* Image timing/progress indicator works.
* Hero supports one video as an alternative media type.
* Headline/description/button can independently be enabled or removed.
* Hero content animates in a restrained premium manner.
* EN/AR works correctly.
* Mobile/tablet/desktop are verified.
* Announcement carousel retains automatic rotation.
* Announcement carousel has previous/next arrows.
* Manual navigation works correctly with automatic rotation.
* CMS edit → save → public live round trip is verified.
* Accessibility and reduced-motion behavior are handled.
* Performance is not unnecessarily degraded.
* No unrelated architecture changes are introduced.
* No console/runtime errors remain from this implementation.

**Do not implement additional features outside this document without approval.**
