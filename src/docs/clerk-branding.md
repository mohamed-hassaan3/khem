# "Secured by Clerk" and the Development-mode pill

Two separate things sit at the bottom of the Clerk card on `/signin` and
`/signup`. They have different causes and different answers, and **neither is to
be hidden with CSS** — see the rule at the end.

## 1. "Secured by Clerk" — removable, in the Dashboard

Clerk supports removing it, and supports it properly:

> Clerk Dashboard → your application's **Settings** → **Branding** → toggle on
> **Remove "Secured by Clerk" branding**.

Two things to know before flipping it:

- **Free in development, paid in production.** Clerk's own wording: the feature
  "requires a paid plan for production use, but all features are free to use in
  development mode". So the toggle will work immediately on the development
  instance this repository is pointed at, and the badge will come back on the
  production instance unless that instance's account is on a paid plan.
- **It is per instance.** Development and production are separate Clerk
  instances with separate settings. Turning it off in one does nothing to the
  other.

There is no code change for this — the setting lives on the account, not in the
appearance object (`src/lib/clerk-appearance.ts`), which is presentation only.

## 2. "Development mode" — not a setting

That pill is Clerk telling the truth about which instance is being used. The
deployment's `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` currently begins `pk_test_`,
which *is* a development instance: relaxed rate limits, a shared dev domain,
sessions that are not production sessions, and a hard cap on users.

It is not removable by configuration and should not be, because it is a safety
signal — a visitor on a development instance is not signing in to the real
boutique. **It disappears on its own** when the deployment runs against a
production instance (`pk_live_…` / a `CLERK_SECRET_KEY` for the production
instance, configured on the production domain). Nothing in this repository needs
to change for that; it is an environment-variable swap on the host.

## The rule

Do not hide either one with CSS — no `display: none` on Clerk's internal class
names, no `:has()` selector, no overlay.

- Clerk's generated class names are not a public API. A selector written against
  them survives until the next Clerk release, and when it breaks it breaks the
  *card*, in production, on the sign-in page.
- For the Development-mode pill specifically, hiding it misrepresents which
  instance a visitor is on. That is the one piece of chrome on this page that
  exists to be honest about something.

If the badge is business-critical, the answer is the Dashboard toggle plus the
plan it requires; if the pill is, the answer is a production instance.
