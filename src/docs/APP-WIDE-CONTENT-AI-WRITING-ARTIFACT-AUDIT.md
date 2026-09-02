# APP-WIDE CONTENT & AI-WRITING ARTIFACT AUDIT

Audit all user-facing text and paragraphs across the entire KHEM application.

The goal is to ensure that the website content feels professionally written for real customers and does not contain visible AI-writing artifacts or formatting patterns that make the content look automatically generated.

## Audit All User-Facing Content

Check:

* Landing pages
* Product pages
* Product descriptions
* Collection pages
* Category pages
* Ritual pages
* Ingredients content
* KHEM Journal
* About/brand content
* Cart
* Checkout
* Account pages
* Authentication pages
* Error messages
* Empty states
* Success messages
* Forms
* Tooltips
* Popups
* Emails
* Navigation
* Footer
* Admin-facing content where appropriate

---

## Remove AI-Writing Artifacts

Look for and fix visible artifacts such as:

* `__` appearing unnecessarily in customer-facing text
* Excessive or unnatural em dashes (`—`)
* Strange separators
* Markdown artifacts accidentally appearing in the UI
* Placeholder formatting
* AI-generated structural patterns that are visible to customers
* Repetitive headings
* Repetitive phrases
* Generic AI wording
* Overly verbose explanations
* Awkward or unnatural sentences
* Unnecessary disclaimers
* Text that sounds like instructions to an AI rather than customer-facing copy
* Internal terminology accidentally exposed to customers

Do not simply search and replace characters globally.

Inspect each occurrence in context.

Some symbols or underscores may be valid in:

* Code
* URLs
* Technical identifiers
* Internal database fields
* File names
* Developer/admin-only content

Do not modify those unless they are visibly presented to users.

---

# CONTENT QUALITY REVIEW

For every customer-facing paragraph, verify that it is:

* Clear
* Natural
* Concise
* Easy to understand
* Professionally written
* Consistent with the KHEM brand
* Not unnecessarily complicated
* Not obviously AI-generated

Remove unnecessary complexity.

Do not make luxury language so dramatic that it becomes unnatural or difficult to understand.

The customer should immediately understand the information.

---

# CLARITY OVER AI-STYLE WRITING

Avoid phrases or structures that sound like generic AI-generated copy.

Do not use unnecessarily complicated language simply to sound luxurious.

Prefer:

```text
Clear + elegant + premium
```

over:

```text
Overwritten + dramatic + generic luxury language
```

The KHEM voice should feel:

* Premium
* Elegant
* Human
* Confident
* Clear
* Warm when appropriate
* Informative

---

# DO NOT BREAK CONTENT

Before changing text:

1. Identify whether the content is static, CMS-driven, database-driven, or translation content.
2. Preserve Arabic and English content correctly.
3. Do not accidentally remove translations.
4. Do not modify product names or technical product specifications incorrectly.
5. Do not change SEO-critical structured metadata without reviewing it.
6. Do not modify code, URLs, database fields, slugs, or internal identifiers through global search and replace.

---

# SPECIFIC CHECK FOR AI FORMATTING

Search the entire user-facing application for visible occurrences of patterns such as:

```text
__
—
---
***
```

and other unusual formatting artifacts.

For each occurrence:

* Determine whether it is intentionally required.
* If it is accidentally visible to customers, remove or replace it.
* If it is legitimate formatting, keep it.

---

# FINAL REVIEW

After the audit:

1. Test the application for visible text artifacts.
2. Review desktop and mobile.
3. Review English and Arabic content.
4. Check all major customer journeys.
5. Confirm that no Markdown syntax or AI-generation artifacts are accidentally displayed.
6. Confirm that text remains understandable and consistent.

Provide a final summary including:

* Pages/content areas audited
* AI-writing artifacts found
* Artifacts removed
* Major paragraphs rewritten for clarity
* Any content intentionally left unchanged and why

## IMPORTANT

Do not rewrite everything unnecessarily.

Preserve good existing content.

The purpose is to remove visible AI-generated patterns and improve clarity, natural language, and customer understanding — not to completely change the KHEM brand voice.
