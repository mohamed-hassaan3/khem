# Adjustments

## 1. HERO Banner Effect — Important Correction

Please look carefully at the attached screenshots.

- **First screenshot:** Body Care — this needs to be fixed.
- **Second screenshot:** Signature — this is the reference and correct result.

I want the HERO/banner effect on Body Care and the other affected pages to match the **Signature HERO exactly in visual behavior**.

This is not about adding a random gradient or animation.

Compare:

- How the banner image is visible at the top.
- How the image smoothly fades downward into the ivory page background.
- How the title, subtitle, description, and page content are visually positioned within this transition.
- The overall balance between the image and ivory background.

Use the existing Signature/Collections/Gemstone implementation as the reference and adapt the affected HERO pages to match that same visual treatment.

Do not change the actual content or unnecessarily redesign the layout.

### Responsive Requirement — Desktop and Mobile

This fix must apply to **both desktop and mobile**, not only mobile.

The main purpose is to ensure users can properly see and experience the HERO/banner image on every page and screen size.

- Compare the reference HERO behavior on both desktop and mobile.
- Ensure the banner image has enough visible area and is not excessively covered or faded.
- The image should smoothly transition into the ivory page background while remaining clearly visible.
- Preserve the important visual parts of each banner image using proper responsive positioning and sizing.
- Check desktop, tablet, and mobile individually.
- Do not simply apply the same fixed dimensions to every screen.
- Make sure each page's banner looks balanced and intentional at every breakpoint.

The final result should give all HERO banners a consistent visual experience across **desktop and mobile**, while allowing users to properly see the banner artwork.
---

## 2. Sign In / Sign Up — Clerk Bottom Branding

The KHEM customization is good, but the Clerk card still displays at the bottom:

- "Secured by Clerk"
- Clerk logo
- "Development mode"

I want this removed **if Clerk officially allows it**.

First check Clerk's supported configuration and current environment.

- Do not use fragile CSS hacks to hide it.
- Do not break authentication.
- If this branding/development indicator cannot be removed in a Clerk development instance, clearly explain that and confirm whether it will disappear after using a production Clerk instance / production mode.

---

## 3. Footer Collections — Make Each Category Collapsible

The new desktop footer organization is good.

Now make each of these groups individually collapsible:

- Fragrances
- Scent Profiles
- Quick Access

Each category should have its own expand/collapse control.

Requirements:

- Clicking a category expands or collapses only its own items.
- Keep the existing organized structure.
- Use a subtle, elegant interaction consistent with KHEM.
- Do not change the mobile footer behavior.
- Do not modify other footer sections.

Keep all changes minimal and test desktop and mobile.